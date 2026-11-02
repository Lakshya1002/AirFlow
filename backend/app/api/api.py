from fastapi import APIRouter
from app.api.endpoints import (
    auth, airlines, airports, aircraft, routes,
    flights, passengers, bookings, payments, fares,
    cancellations, analytics, reports
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(airlines.router)
api_router.include_router(airports.router)
api_router.include_router(aircraft.router)
api_router.include_router(routes.router)
api_router.include_router(flights.router)
api_router.include_router(passengers.router)
api_router.include_router(bookings.router)
api_router.include_router(payments.router)
api_router.include_router(fares.router)
api_router.include_router(cancellations.router)
api_router.include_router(analytics.router)
api_router.include_router(reports.router)
