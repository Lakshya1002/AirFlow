from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database.session import get_db
from app.models.models import Passenger
from app.schemas.schemas import PassengerCreate, PassengerOut
from app.api.deps import require_admin, require_analyst

router = APIRouter(prefix="/passengers", tags=["Passengers"])

@router.get("", response_model=List[PassengerOut])
def list_passengers(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    query = db.query(Passenger)
    if search:
        query = query.filter(
            Passenger.full_name.ilike(f"%{search}%") |
            Passenger.email.ilike(f"%{search}%") |
            Passenger.phone.ilike(f"%{search}%")
        )
    return query.order_by(Passenger.passenger_id.desc()).offset(skip).limit(limit).all()

@router.post("", response_model=PassengerOut)
def create_passenger(
    passenger_in: PassengerCreate,
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    if db.query(Passenger).filter(Passenger.email == passenger_in.email.lower()).first():
        raise HTTPException(status_code=400, detail="Passenger with this email already exists")
    
    passenger = Passenger(
        full_name=passenger_in.full_name,
        email=passenger_in.email.lower(),
        phone=passenger_in.phone
    )
    db.add(passenger)
    db.commit()
    db.refresh(passenger)
    return passenger

@router.get("/{passenger_id}", response_model=PassengerOut)
def get_passenger(
    passenger_id: int,
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    p = db.query(Passenger).filter(Passenger.passenger_id == passenger_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Passenger not found")
    return p
