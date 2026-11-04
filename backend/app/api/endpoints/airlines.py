from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database.session import get_db
from app.models.models import Airline
from app.schemas.schemas import AirlineCreate, AirlineOut
from app.api.deps import require_admin, require_analyst

router = APIRouter(prefix="/airlines", tags=["Airlines"])

@router.get("", response_model=List[AirlineOut])
def list_airlines(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    query = db.query(Airline)
    if search:
        query = query.filter(Airline.airline_name.ilike(f"%{search}%") | Airline.airline_code.ilike(f"%{search}%"))
    return query.offset(skip).limit(limit).all()

@router.post("", response_model=AirlineOut)
def create_airline(
    airline_in: AirlineCreate,
    db: Session = Depends(get_db),
    admin = Depends(require_admin)
):
    existing = db.query(Airline).filter(Airline.airline_code == airline_in.airline_code.upper()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Airline code already exists")
    
    airline = Airline(
        airline_name=airline_in.airline_name,
        airline_code=airline_in.airline_code.upper(),
        country=airline_in.country
    )
    db.add(airline)
    db.commit()
    db.refresh(airline)
    return airline

@router.delete("/{airline_id}")
def delete_airline(
    airline_id: int,
    db: Session = Depends(get_db),
    admin = Depends(require_admin)
):
    airline = db.query(Airline).filter(Airline.airline_id == airline_id).first()
    if not airline:
        raise HTTPException(status_code=404, detail="Airline not found")
    
    # Check dependent records
    if airline.flights or airline.aircraft:
        raise HTTPException(status_code=400, detail="Cannot delete airline with existing aircraft or flights")
    
    db.delete(airline)
    db.commit()
    return {"message": "Airline deleted successfully"}

