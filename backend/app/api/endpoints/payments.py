from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database.session import get_db
from app.models.models import Payment
from app.schemas.schemas import PaymentOut
from app.api.deps import require_analyst

router = APIRouter(prefix="/payments", tags=["Payments"])

@router.get("", response_model=List[PaymentOut])
def list_payments(
    skip: int = 0,
    limit: int = 100,
    booking_id: Optional[int] = None,
    payment_type: Optional[str] = None,
    payment_status: Optional[str] = None,
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    query = db.query(Payment)
    if booking_id:
        query = query.filter(Payment.booking_id == booking_id)
    if payment_type:
        query = query.filter(Payment.payment_type == payment_type.upper())
    if payment_status:
        query = query.filter(Payment.payment_status == payment_status.upper())
    
    return query.order_by(Payment.payment_date.desc()).offset(skip).limit(limit).all()

@router.get("/{payment_id}", response_model=PaymentOut)
def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    p = db.query(Payment).filter(Payment.payment_id == payment_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payment record not found")
    return p
