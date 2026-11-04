from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database.session import get_db
from app.models.models import Route, Airport, Flight
from app.schemas.schemas import RouteCreate, RouteOut
from app.api.deps import require_admin, require_analyst

router = APIRouter(prefix="/routes", tags=["Routes"])

@router.get("", response_model=List[RouteOut])
def list_routes(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    routes = db.query(Route).offset(skip).limit(limit).all()
    results = []
    for r in routes:
        results.append({
            "route_id": r.route_id,
            "origin_airport_id": r.origin_airport_id,
            "destination_airport_id": r.destination_airport_id,
            "distance_km": r.distance_km,
            "origin_code": r.origin_airport.airport_code if r.origin_airport else None,
            "destination_code": r.destination_airport.airport_code if r.destination_airport else None,
            "origin_city": r.origin_airport.city if r.origin_airport else None,
            "destination_city": r.destination_airport.city if r.destination_airport else None,
        })
    return results

@router.post("", response_model=RouteOut)
def create_route(
    route_in: RouteCreate,
    db: Session = Depends(get_db),
    admin = Depends(require_admin)
):
    if route_in.origin_airport_id == route_in.destination_airport_id:
        raise HTTPException(status_code=400, detail="Origin and destination must be different airports")
    
    orig = db.query(Airport).filter(Airport.airport_id == route_in.origin_airport_id).first()
    dest = db.query(Airport).filter(Airport.airport_id == route_in.destination_airport_id).first()
    if not orig or not dest:
        raise HTTPException(status_code=400, detail="Origin or destination airport not found")
    
    route = Route(
        origin_airport_id=route_in.origin_airport_id,
        destination_airport_id=route_in.destination_airport_id,
        distance_km=route_in.distance_km
    )
    db.add(route)
    db.commit()
    db.refresh(route)
    return {
        "route_id": route.route_id,
        "origin_airport_id": route.origin_airport_id,
        "destination_airport_id": route.destination_airport_id,
        "distance_km": route.distance_km,
        "origin_code": orig.airport_code,
        "destination_code": dest.airport_code,
        "origin_city": orig.city,
        "destination_city": dest.city,
    }

@router.delete("/{route_id}")
def delete_route(
    route_id: int,
    db: Session = Depends(get_db),
    admin = Depends(require_admin)
):
    route = db.query(Route).filter(Route.route_id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    if db.query(Flight).filter(Flight.route_id == route_id).first():
        raise HTTPException(status_code=400, detail="Cannot delete route with scheduled flights")
    db.delete(route)
    db.commit()
    return {"message": "Route deleted successfully"}

