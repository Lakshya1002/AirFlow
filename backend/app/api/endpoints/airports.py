from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database.session import get_db
from app.models.models import Airport, Route
from app.schemas.schemas import AirportCreate, AirportOut
from app.api.deps import require_admin, require_analyst

router = APIRouter(prefix="/airports", tags=["Airports"])

@router.get("", response_model=List[AirportOut])
def list_airports(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    query = db.query(Airport)
    if search:
        query = query.filter(
            Airport.airport_code.ilike(f"%{search}%") |
            Airport.airport_name.ilike(f"%{search}%") |
            Airport.city.ilike(f"%{search}%")
        )
    return query.offset(skip).limit(limit).all()

@router.post("", response_model=AirportOut)
def create_airport(
    airport_in: AirportCreate,
    db: Session = Depends(get_db),
    admin = Depends(require_admin)
):
    existing = db.query(Airport).filter(Airport.airport_code == airport_in.airport_code.upper()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Airport code already exists")
    
    airport = Airport(
        airport_code=airport_in.airport_code.upper(),
        airport_name=airport_in.airport_name,
        city=airport_in.city,
        country=airport_in.country
    )
    db.add(airport)
    db.commit()
    db.refresh(airport)
    return airport

@router.delete("/{airport_id}")
def delete_airport(
    airport_id: int,
    db: Session = Depends(get_db),
    admin = Depends(require_admin)
):
    airport = db.query(Airport).filter(Airport.airport_id == airport_id).first()
    if not airport:
        raise HTTPException(status_code=404, detail="Airport not found")
    
    # Check dependent routes
    routes = db.query(Route).filter(
        (Route.origin_airport_id == airport_id) | (Route.destination_airport_id == airport_id)
    ).first()
    if routes:
        raise HTTPException(status_code=400, detail="Cannot delete airport referenced by existing routes")
    
    db.delete(airport)
    db.commit()
    return {"message": "Airport deleted successfully"}
