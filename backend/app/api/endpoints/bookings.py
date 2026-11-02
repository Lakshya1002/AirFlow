import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional, Dict, Any
from app.database.session import get_db
from app.models.models import Booking, Flight, Passenger
from app.schemas.schemas import BookingCreateRequest, BookingOut
from app.api.deps import require_analyst

router = APIRouter(prefix="/bookings", tags=["Bookings"])

@router.get("", response_model=List[BookingOut])
def list_bookings(
    skip: int = 0,
    limit: int = 100,
    flight_id: Optional[int] = None,
    passenger_id: Optional[int] = None,
    booking_status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    query = db.query(Booking)
    if flight_id:
        query = query.filter(Booking.flight_id == flight_id)
    if passenger_id:
        query = query.filter(Booking.passenger_id == passenger_id)
    if booking_status:
        query = query.filter(Booking.booking_status == booking_status.upper())
    if search:
        query = query.filter(Booking.booking_reference.ilike(f"%{search}%"))

    bookings = query.order_by(Booking.booking_date.desc()).offset(skip).limit(limit).all()
    results = []
    for b in bookings:
        results.append({
            "booking_id": b.booking_id,
            "booking_reference": b.booking_reference,
            "passenger_id": b.passenger_id,
            "flight_id": b.flight_id,
            "booking_date": b.booking_date,
            "booking_status": b.booking_status,
            "total_amount": b.total_amount,
            "booking_metadata": b.booking_metadata if isinstance(b.booking_metadata, dict) else None,
            "passenger_name": b.passenger.full_name if b.passenger else None,
            "flight_number": b.flight.flight_number if b.flight else None,
        })
    return results

@router.get("/{booking_id}")
def get_booking_detail(
    booking_id: int,
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    # Using database view vw_booking_summary
    sql = text("SELECT * FROM vw_booking_summary WHERE booking_id = :bid")
    row = db.execute(sql, {"bid": booking_id}).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Also fetch payment history
    payments = db.execute(
        text("SELECT * FROM payments WHERE booking_id = :bid ORDER BY payment_date"),
        {"bid": booking_id}
    ).mappings().all()

    return {
        "booking": dict(row),
        "payments": [dict(p) for p in payments]
    }

@router.post("")
def create_booking(
    booking_req: BookingCreateRequest,
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    if not booking_req.seat_ids:
        raise HTTPException(status_code=400, detail="Must select at least one seat")

    seat_ids_str = ",".join(str(s) for s in booking_req.seat_ids)
    sim_fail = 1 if booking_req.simulate_fail else 0
    meta_json = json.dumps(booking_req.metadata) if booking_req.metadata else None

    try:
        # CALL STORED PROCEDURE sp_process_booking
        # Uses row locking (SELECT ... FOR UPDATE) and handles transactional execution
        result = db.execute(
            text("CALL sp_process_booking(:pid, :fid, :sids, :pm, :sf, :meta)"),
            {
                "pid": booking_req.passenger_id,
                "fid": booking_req.flight_id,
                "sids": seat_ids_str,
                "pm": booking_req.payment_method,
                "sf": sim_fail,
                "meta": meta_json
            }
        ).mappings().first()
        db.commit()

        return dict(result)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{booking_id}/cancel")
def cancel_booking(
    booking_id: int,
    reason_data: Dict[str, str],
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    reason = reason_data.get("reason", "Customer requested cancellation")
    try:
        # CALL STORED PROCEDURE sp_process_cancellation
        result = db.execute(
            text("CALL sp_process_cancellation(:bid, :reason)"),
            {"bid": booking_id, "reason": reason}
        ).mappings().first()
        db.commit()
        return dict(result)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
