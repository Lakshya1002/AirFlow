from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database.session import get_db
from app.models.models import Aircraft, AircraftSeat, Flight
from app.schemas.schemas import AircraftCreate, AircraftOut
from app.api.deps import require_admin, require_analyst

router = APIRouter(prefix="/aircraft", tags=["Aircraft"])

@router.get("", response_model=List[AircraftOut])
def list_aircraft(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    return db.query(Aircraft).offset(skip).limit(limit).all()

@router.post("", response_model=AircraftOut)
def create_aircraft(
    aircraft_in: AircraftCreate,
    db: Session = Depends(get_db),
    admin = Depends(require_admin)
):
    if db.query(Aircraft).filter(Aircraft.registration_number == aircraft_in.registration_number).first():
        raise HTTPException(status_code=400, detail="Registration number already exists")
    
    total = (
        aircraft_in.layout.economy_seats +
        aircraft_in.layout.business_seats +
        aircraft_in.layout.first_seats
    )
    if total <= 0:
        raise HTTPException(status_code=400, detail="Aircraft must have positive capacity")
    
    aircraft = Aircraft(
        airline_id=aircraft_in.airline_id,
        registration_number=aircraft_in.registration_number.upper(),
        model=aircraft_in.model,
        total_capacity=total
    )
    db.add(aircraft)
    db.commit()
    db.refresh(aircraft)

    # Generate permanent seat layout in aircraft_seats
    row = 1
    # First class (2+2: A, B, C, D)
    for i in range(aircraft_in.layout.first_seats):
        col = chr(65 + (i % 4))
        db.add(AircraftSeat(aircraft_id=aircraft.aircraft_id, seat_number=f"{row}{col}", seat_class="FIRST"))
        if col == "D":
            row += 1
    if aircraft_in.layout.first_seats > 0 and (aircraft_in.layout.first_seats % 4) != 0:
        row += 1
    if aircraft_in.layout.first_seats > 0:
        row += 1

    # Business class (3+3: A-F)
    for i in range(aircraft_in.layout.business_seats):
        col = chr(65 + (i % 6))
        db.add(AircraftSeat(aircraft_id=aircraft.aircraft_id, seat_number=f"{row}{col}", seat_class="BUSINESS"))
        if col == "F":
            row += 1
    if aircraft_in.layout.business_seats > 0 and (aircraft_in.layout.business_seats % 6) != 0:
        row += 1
    if aircraft_in.layout.business_seats > 0:
        row += 1

    # Economy class (3+3: A-F)
    for i in range(aircraft_in.layout.economy_seats):
        col = chr(65 + (i % 6))
        db.add(AircraftSeat(aircraft_id=aircraft.aircraft_id, seat_number=f"{row}{col}", seat_class="ECONOMY"))
        if col == "F":
            row += 1

    db.commit()
    return aircraft

@router.delete("/{aircraft_id}")
def delete_aircraft(
    aircraft_id: int,
    db: Session = Depends(get_db),
    admin = Depends(require_admin)
):
    aircraft = db.query(Aircraft).filter(Aircraft.aircraft_id == aircraft_id).first()
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    
    if db.query(Flight).filter(Flight.aircraft_id == aircraft_id).first():
        raise HTTPException(status_code=400, detail="Cannot delete aircraft assigned to flights")
    
    db.query(AircraftSeat).filter(AircraftSeat.aircraft_id == aircraft_id).delete()
    db.delete(aircraft)
    db.commit()
    return {"message": "Aircraft and seat layout deleted"}
