from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from datetime import datetime
from app.database.session import get_db
from app.models.models import Flight, Airline, Route, FlightSeat, AircraftSeat, Fare
from app.schemas.schemas import FlightCreate, FlightOut, FlightStatusUpdate, FareOut
from app.api.deps import require_admin, require_analyst

router = APIRouter(prefix="/flights", tags=["Flights"])

@router.get("", response_model=List[FlightOut])
def list_flights(
    skip: int = 0,
    limit: int = 100,
    airline_id: Optional[int] = None,
    flight_status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    query = db.query(Flight)
    if airline_id:
        query = query.filter(Flight.airline_id == airline_id)
    if flight_status:
        query = query.filter(Flight.flight_status == flight_status.upper())
    if start_date:
        query = query.filter(Flight.departure_time >= start_date)
    if end_date:
        query = query.filter(Flight.departure_time <= end_date)

    flights = query.order_by(Flight.departure_time.desc()).offset(skip).limit(limit).all()
    results = []
    for f in flights:
        results.append({
            "flight_id": f.flight_id,
            "airline_id": f.airline_id,
            "aircraft_id": f.aircraft_id,
            "route_id": f.route_id,
            "flight_number": f.flight_number,
            "departure_time": f.departure_time,
            "arrival_time": f.arrival_time,
            "flight_status": f.flight_status,
            "airline_name": f.airline.airline_name if f.airline else None,
            "airline_code": f.airline.airline_code if f.airline else None,
            "origin_code": f.route.origin_airport.airport_code if f.route and f.route.origin_airport else None,
            "destination_code": f.route.destination_airport.airport_code if f.route and f.route.destination_airport else None,
            "created_at": f.created_at,
        })
    return results

@router.post("", response_model=FlightOut)
def create_flight(
    flight_in: FlightCreate,
    db: Session = Depends(get_db),
    admin = Depends(require_admin)
):
    if flight_in.arrival_time <= flight_in.departure_time:
        raise HTTPException(status_code=400, detail="Arrival time must be strictly after departure time")

    flight = Flight(
        airline_id=flight_in.airline_id,
        aircraft_id=flight_in.aircraft_id,
        route_id=flight_in.route_id,
        flight_number=flight_in.flight_number.upper(),
        departure_time=flight_in.departure_time,
        arrival_time=flight_in.arrival_time,
        flight_status=flight_in.flight_status.upper()
    )
    db.add(flight)
    db.commit()
    db.refresh(flight)

    # CALL STORED PROCEDURE sp_create_flight_seats
    try:
        db.execute(text("CALL sp_create_flight_seats(:fid, :aid)"), {
            "fid": flight.flight_id,
            "aid": flight.aircraft_id
        })
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to initialize seat inventory via procedure: {str(e)}")

    return {
        "flight_id": flight.flight_id,
        "airline_id": flight.airline_id,
        "aircraft_id": flight.aircraft_id,
        "route_id": flight.route_id,
        "flight_number": flight.flight_number,
        "departure_time": flight.departure_time,
        "arrival_time": flight.arrival_time,
        "flight_status": flight.flight_status,
        "airline_name": flight.airline.airline_name if flight.airline else None,
        "airline_code": flight.airline.airline_code if flight.airline else None,
        "origin_code": flight.route.origin_airport.airport_code if flight.route and flight.route.origin_airport else None,
        "destination_code": flight.route.destination_airport.airport_code if flight.route and flight.route.destination_airport else None,
        "created_at": flight.created_at,
    }

@router.get("/{flight_id}", response_model=FlightOut)
def get_flight(
    flight_id: int,
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    f = db.query(Flight).filter(Flight.flight_id == flight_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Flight not found")
    return {
        "flight_id": f.flight_id,
        "airline_id": f.airline_id,
        "aircraft_id": f.aircraft_id,
        "route_id": f.route_id,
        "flight_number": f.flight_number,
        "departure_time": f.departure_time,
        "arrival_time": f.arrival_time,
        "flight_status": f.flight_status,
        "airline_name": f.airline.airline_name if f.airline else None,
        "airline_code": f.airline.airline_code if f.airline else None,
        "origin_code": f.route.origin_airport.airport_code if f.route and f.route.origin_airport else None,
        "destination_code": f.route.destination_airport.airport_code if f.route and f.route.destination_airport else None,
        "created_at": f.created_at,
    }

@router.patch("/{flight_id}/status")
def update_flight_status(
    flight_id: int,
    status_update: FlightStatusUpdate,
    db: Session = Depends(get_db),
    admin = Depends(require_admin)
):
    flight = db.query(Flight).filter(Flight.flight_id == flight_id).first()
    if not flight:
        raise HTTPException(status_code=404, detail="Flight not found")
    
    try:
        flight.flight_status = status_update.flight_status.upper()
        db.commit()
    except Exception as e:
        db.rollback()
        # The MySQL trigger trg_flight_status_validate raises error on invalid transition
        raise HTTPException(status_code=400, detail=str(e))
    
    return {"message": "Status updated", "flight_status": flight.flight_status}

@router.get("/{flight_id}/seats")
def get_flight_seats(
    flight_id: int,
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    sql = text("""
        SELECT 
            fs.flight_seat_id,
            fs.seat_status,
            acs.seat_number,
            acs.seat_class
        FROM flight_seats fs
        INNER JOIN aircraft_seats acs ON fs.aircraft_seat_id = acs.aircraft_seat_id
        WHERE fs.flight_id = :fid
        ORDER BY acs.seat_class, acs.seat_number
    """)
    rows = db.execute(sql, {"fid": flight_id}).mappings().all()
    return list(rows)

@router.get("/{flight_id}/available-seats")
def get_available_seats(
    flight_id: int,
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    sql = text("""
        SELECT 
            fs.flight_seat_id,
            acs.seat_number,
            acs.seat_class,
            COALESCE(fa.base_fare, 5000.00) AS fare
        FROM flight_seats fs
        INNER JOIN aircraft_seats acs ON fs.aircraft_seat_id = acs.aircraft_seat_id
        LEFT JOIN fares fa ON fa.flight_id = fs.flight_id
                           AND fa.fare_class = acs.seat_class
                           AND CURDATE() BETWEEN fa.valid_from AND COALESCE(fa.valid_until, '9999-12-31')
        WHERE fs.flight_id = :fid
          AND fs.seat_status = 'AVAILABLE'
          AND NOT EXISTS (
              SELECT 1 FROM booking_seats bs 
              WHERE bs.flight_seat_id = fs.flight_seat_id 
                AND bs.seat_status IN ('HELD', 'CONFIRMED')
          )
        ORDER BY acs.seat_class, acs.seat_number
    """)
    rows = db.execute(sql, {"fid": flight_id}).mappings().all()
    return list(rows)

@router.get("/{flight_id}/fares", response_model=List[FareOut])
def get_flight_fares(
    flight_id: int,
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    return db.query(Fare).filter(Fare.flight_id == flight_id).all()

