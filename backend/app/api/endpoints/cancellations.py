from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from app.database.session import get_db
from app.models.models import Cancellation
from app.schemas.schemas import CancellationOut
from app.api.deps import require_analyst

router = APIRouter(prefix="/cancellations", tags=["Cancellations"])

@router.get("", response_model=List[CancellationOut])
def list_cancellations(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    return db.query(Cancellation).order_by(Cancellation.cancellation_date.desc()).offset(skip).limit(limit).all()

@router.get("/{cancellation_id}", response_model=CancellationOut)
def get_cancellation(
    cancellation_id: int,
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    c = db.query(Cancellation).filter(Cancellation.cancellation_id == cancellation_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Cancellation not found")
    return c

