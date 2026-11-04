from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any, Dict
from datetime import datetime, date
from decimal import Decimal

# --- Auth Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: str = "ANALYST"

class UserOut(BaseModel):
    user_id: int
    username: str
    email: EmailStr
    role: str
    created_at: Optional[datetime]

    class Config:
        from_attributes = True

# --- Airline Schemas ---
class AirlineBase(BaseModel):
    airline_name: str
    airline_code: str
    country: Optional[str] = None

class AirlineCreate(AirlineBase):
    pass

class AirlineOut(AirlineBase):
    airline_id: int
    created_at: Optional[datetime]

    class Config:
        from_attributes = True

# --- Airport Schemas ---
class AirportBase(BaseModel):
    airport_code: str
    airport_name: str
    city: Optional[str] = None
    country: Optional[str] = None

class AirportCreate(AirportBase):
    pass

class AirportOut(AirportBase):
    airport_id: int

    class Config:
        from_attributes = True

# --- Aircraft Schemas ---
class AircraftSeatLayoutCreate(BaseModel):
    economy_seats: int = 150
    business_seats: int = 12
    first_seats: int = 0

class AircraftCreate(BaseModel):
    airline_id: int
    registration_number: str
    model: str
    layout: AircraftSeatLayoutCreate

class AircraftOut(BaseModel):
    aircraft_id: int
    airline_id: int
    registration_number: str
    model: str
    total_capacity: int

    class Config:
        from_attributes = True

# --- Route Schemas ---
class RouteCreate(BaseModel):
    origin_airport_id: int
    destination_airport_id: int
    distance_km: Decimal

class RouteOut(BaseModel):
    route_id: int
    origin_airport_id: int
    destination_airport_id: int
    distance_km: Optional[Decimal]
    origin_code: Optional[str] = None
    destination_code: Optional[str] = None
    origin_city: Optional[str] = None
    destination_city: Optional[str] = None

    class Config:
        from_attributes = True

# --- Flight Schemas ---
class FlightCreate(BaseModel):
    airline_id: int
    aircraft_id: int
    route_id: int
    flight_number: str
    departure_time: datetime
    arrival_time: datetime
    flight_status: str = "SCHEDULED"

class FlightStatusUpdate(BaseModel):
    flight_status: str

class FlightOut(BaseModel):
    flight_id: int
    airline_id: int
    aircraft_id: int
    route_id: int
    flight_number: str
    departure_time: datetime
    arrival_time: datetime
    flight_status: str
    airline_name: Optional[str] = None
    airline_code: Optional[str] = None
    origin_code: Optional[str] = None
    destination_code: Optional[str] = None
    created_at: Optional[datetime]

    class Config:
        from_attributes = True

# --- Passenger Schemas ---
class PassengerBase(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None

class PassengerCreate(PassengerBase):
    pass

class PassengerOut(PassengerBase):
    passenger_id: int
    created_at: Optional[datetime]

    class Config:
        from_attributes = True

# --- Booking Schemas ---
class BookingCreateRequest(BaseModel):
    passenger_id: int
    flight_id: int
    seat_ids: List[int]
    payment_method: str = "CREDIT_CARD"
    simulate_fail: bool = False
    metadata: Optional[Dict[str, Any]] = None

class BookingOut(BaseModel):
    booking_id: int
    booking_reference: str
    passenger_id: int
    flight_id: int
    booking_date: datetime
    booking_status: str
    total_amount: Decimal
    booking_metadata: Optional[Dict[str, Any]] = None
    passenger_name: Optional[str] = None
    flight_number: Optional[str] = None

    class Config:
        from_attributes = True

# --- Payment Schemas ---
class PaymentOut(BaseModel):
    payment_id: int
    booking_id: int
    amount: Decimal
    payment_method: Optional[str]
    payment_type: str
    payment_status: str
    transaction_reference: str
    payment_date: datetime

    class Config:
        from_attributes = True

# --- Fare Schemas ---
class FareCreate(BaseModel):
    flight_id: int
    fare_class: str
    base_fare: Decimal
    currency: str = "INR"
    valid_from: date
    valid_until: Optional[date] = None

class FareUpdate(BaseModel):
    base_fare: Optional[Decimal] = None
    valid_until: Optional[date] = None

class FareOut(BaseModel):
    fare_id: int
    flight_id: int
    fare_class: str
    base_fare: Decimal
    currency: str
    valid_from: date
    valid_until: Optional[date] = None

    class Config:
        from_attributes = True

# --- Cancellation Schemas ---
class CancellationCreate(BaseModel):
    booking_id: int
    cancellation_reason: str

class CancellationOut(BaseModel):
    cancellation_id: int
    booking_id: int
    cancellation_date: datetime
    cancellation_reason: Optional[str]
    refund_amount: Decimal

    class Config:
        from_attributes = True

# --- Fare Scenario Simulation ---
class FareScenarioRequest(BaseModel):
    flight_id: int
    fare_class: str
    proposed_fare: Decimal
    demand_elasticity: float = -1.2  # user-entered assumption

class FareScenarioResponse(BaseModel):
    flight_id: int
    fare_class: str
    original_fare: Decimal
    proposed_fare: Decimal
    pct_fare_change: float
    current_seats_sold: int
    assumed_elasticity: float
    estimated_seats_demanded: int
    original_revenue: Decimal
    estimated_revenue: Decimal
    revenue_difference: Decimal
    disclaimer: str = "Simulation based strictly on user-entered elasticity assumptions. Not a predictive ML forecast."

