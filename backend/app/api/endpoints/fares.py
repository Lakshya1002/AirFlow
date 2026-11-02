from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from app.database.session import get_db
from app.models.models import Fare, Flight
from app.schemas.schemas import FareCreate, FareUpdate, FareOut
from app.api.deps import require_admin, require_analyst

router = APIRouter(prefix="/fares", tags=["Fares"])

@router.get("", response_model=List[FareOut])
def list_fares(
    flight_id: Optional[int] = None,
    fare_class: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    query = db.query(Fare)
    if flight_id:
        query = query.filter(Fare.flight_id == flight_id)
    if fare_class:
        query = query.filter(Fare.fare_class == fare_class.upper())
    return query.order_by(Fare.valid_from.desc()).offset(skip).limit(limit).all()

@router.post("", response_model=FareOut)
def create_fare(
    fare_in: FareCreate,
    db: Session = Depends(get_db),
    admin = Depends(require_admin)
):
    if fare_in.base_fare <= 0:
        raise HTTPException(status_code=400, detail="Base fare must be positive")
    
    # Check flight exists
    if not db.query(Flight).filter(Flight.flight_id == fare_in.flight_id).first():
        raise HTTPException(status_code=400, detail="Flight not found")

    # Prevent overlapping validity periods for same flight + fare_class
    overlap_check = text("""
        SELECT fare_id FROM fares
        WHERE flight_id = :fid
          AND fare_class = :fc
          AND (
              (:vfrom BETWEEN valid_from AND COALESCE(valid_until, '9999-12-31'))
              OR
              (:vuntil IS NOT NULL AND :vuntil BETWEEN valid_from AND COALESCE(valid_until, '9999-12-31'))
          )
    """)
    overlap = db.execute(overlap_check, {
        "fid": fare_in.flight_id,
        "fc": fare_in.fare_class.upper(),
        "vfrom": fare_in.valid_from,
        "vuntil": fare_in.valid_until
    }).first()
    
    if overlap:
        raise HTTPException(status_code=400, detail="Overlapping validity period exists for this flight and fare class")

    fare = Fare(
        flight_id=fare_in.flight_id,
        fare_class=fare_in.fare_class.upper(),
        base_fare=fare_in.base_fare,
        currency=fare_in.currency.upper(),
        valid_from=fare_in.valid_from,
        valid_until=fare_in.valid_until
    )
    db.add(fare)
    db.commit()
    db.refresh(fare)
    return fare

@router.put("/{fare_id}", response_model=FareOut)
def update_fare(
    fare_id: int,
    fare_update: FareUpdate,
    db: Session = Depends(get_db),
    admin = Depends(require_admin)
):
    fare = db.query(Fare).filter(Fare.fare_id == fare_id).first()
    if not fare:
        raise HTTPException(status_code=404, detail="Fare not found")
    
    if fare_update.base_fare is not None:
        if fare_update.base_fare <= 0:
            raise HTTPException(status_code=400, detail="Base fare must be positive")
        fare.base_fare = fare_update.base_fare

    if fare_update.valid_until is not None:
        fare.valid_until = fare_update.valid_until

    db.commit()
    db.refresh(fare)
    return fare
