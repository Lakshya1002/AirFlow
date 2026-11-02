from sqlalchemy import (
    Column, Integer, BigInteger, String, CHAR, DECIMAL,
    DateTime, ForeignKey, Enum, JSON, CheckConstraint, UniqueConstraint, func
)
from sqlalchemy.orm import relationship
from app.database.session import Base

class Airline(Base):
    __tablename__ = "airlines"

    airline_id = Column(Integer, primary_key=True, autoincrement=True)
    airline_name = Column(String(100), nullable=False)
    airline_code = Column(String(5), nullable=False, unique=True)
    country = Column(String(60))
    created_at = Column(DateTime, server_default=func.now())

    aircraft = relationship("Aircraft", back_populates="airline")
    flights = relationship("Flight", back_populates="airline")


class Airport(Base):
    __tablename__ = "airports"

    airport_id = Column(Integer, primary_key=True, autoincrement=True)
    airport_code = Column(CHAR(3), nullable=False, unique=True)
    airport_name = Column(String(150), nullable=False)
    city = Column(String(80))
    country = Column(String(60))


class Aircraft(Base):
    __tablename__ = "aircraft"

    aircraft_id = Column(Integer, primary_key=True, autoincrement=True)
    airline_id = Column(Integer, ForeignKey("airlines.airline_id"), nullable=False)
    registration_number = Column(String(20), nullable=False, unique=True)
    model = Column(String(80), nullable=False)
    total_capacity = Column(Integer, nullable=False)

    airline = relationship("Airline", back_populates="aircraft")
    seats = relationship("AircraftSeat", back_populates="aircraft")
    flights = relationship("Flight", back_populates="aircraft")


class AircraftSeat(Base):
    __tablename__ = "aircraft_seats"

    aircraft_seat_id = Column(Integer, primary_key=True, autoincrement=True)
    aircraft_id = Column(Integer, ForeignKey("aircraft.aircraft_id"), nullable=False)
    seat_number = Column(String(5), nullable=False)
    seat_class = Column(Enum("ECONOMY", "BUSINESS", "FIRST"), nullable=False)

    aircraft = relationship("Aircraft", back_populates="seats")


class Route(Base):
    __tablename__ = "routes"

    route_id = Column(Integer, primary_key=True, autoincrement=True)
    origin_airport_id = Column(Integer, ForeignKey("airports.airport_id"), nullable=False)
    destination_airport_id = Column(Integer, ForeignKey("airports.airport_id"), nullable=False)
    distance_km = Column(DECIMAL(10, 2))

    origin_airport = relationship("Airport", foreign_keys=[origin_airport_id])
    destination_airport = relationship("Airport", foreign_keys=[destination_airport_id])
    flights = relationship("Flight", back_populates="route")


class Flight(Base):
    __tablename__ = "flights"

    flight_id = Column(BigInteger, primary_key=True, autoincrement=True)
    airline_id = Column(Integer, ForeignKey("airlines.airline_id"), nullable=False)
    aircraft_id = Column(Integer, ForeignKey("aircraft.aircraft_id"), nullable=False)
    route_id = Column(Integer, ForeignKey("routes.route_id"), nullable=False)
    flight_number = Column(String(10), nullable=False)
    departure_time = Column(DateTime, nullable=False)
    arrival_time = Column(DateTime, nullable=False)
    flight_status = Column(Enum("SCHEDULED", "BOARDING", "COMPLETED", "CANCELLED"), nullable=False, default="SCHEDULED")
    created_at = Column(DateTime, server_default=func.now())

    airline = relationship("Airline", back_populates="flights")
    aircraft = relationship("Aircraft", back_populates="flights")
    route = relationship("Route", back_populates="flights")
    seats = relationship("FlightSeat", back_populates="flight")
    fares = relationship("Fare", back_populates="flight")
    bookings = relationship("Booking", back_populates="flight")


class FlightSeat(Base):
    __tablename__ = "flight_seats"

    flight_seat_id = Column(BigInteger, primary_key=True, autoincrement=True)
    flight_id = Column(BigInteger, ForeignKey("flights.flight_id"), nullable=False)
    aircraft_seat_id = Column(Integer, ForeignKey("aircraft_seats.aircraft_seat_id"), nullable=False)
    seat_status = Column(Enum("AVAILABLE", "BOOKED", "BLOCKED"), nullable=False, default="AVAILABLE")

    flight = relationship("Flight", back_populates="seats")
    aircraft_seat = relationship("AircraftSeat")


class Passenger(Base):
    __tablename__ = "passengers"

    passenger_id = Column(Integer, primary_key=True, autoincrement=True)
    full_name = Column(String(120), nullable=False)
    email = Column(String(150), nullable=False, unique=True)
    phone = Column(String(20))
    created_at = Column(DateTime, server_default=func.now())

    bookings = relationship("Booking", back_populates="passenger")


class Booking(Base):
    __tablename__ = "bookings"

    booking_id = Column(BigInteger, primary_key=True, autoincrement=True)
    booking_reference = Column(String(10), nullable=False, unique=True)
    passenger_id = Column(Integer, ForeignKey("passengers.passenger_id"), nullable=False)
    flight_id = Column(BigInteger, ForeignKey("flights.flight_id"), nullable=False)
    booking_date = Column(DateTime, nullable=False, server_default=func.now())
    booking_status = Column(Enum("PENDING", "CONFIRMED", "CANCELLED"), nullable=False, default="PENDING")
    total_amount = Column(DECIMAL(12, 2), nullable=False, default=0.00)
    booking_metadata = Column(JSON)

    passenger = relationship("Passenger", back_populates="bookings")
    flight = relationship("Flight", back_populates="bookings")
    booking_seats = relationship("BookingSeat", back_populates="booking")
    payments = relationship("Payment", back_populates="booking")
    cancellation = relationship("Cancellation", back_populates="booking", uselist=False)


class BookingSeat(Base):
    __tablename__ = "booking_seats"

    booking_seat_id = Column(BigInteger, primary_key=True, autoincrement=True)
    booking_id = Column(BigInteger, ForeignKey("bookings.booking_id"), nullable=False)
    flight_seat_id = Column(BigInteger, ForeignKey("flight_seats.flight_seat_id"), nullable=False)
    seat_status = Column(Enum("HELD", "CONFIRMED", "CANCELLED"), nullable=False, default="HELD")

    booking = relationship("Booking", back_populates="booking_seats")
    flight_seat = relationship("FlightSeat")


class Payment(Base):
    __tablename__ = "payments"

    payment_id = Column(BigInteger, primary_key=True, autoincrement=True)
    booking_id = Column(BigInteger, ForeignKey("bookings.booking_id"), nullable=False)
    amount = Column(DECIMAL(12, 2), nullable=False)
    payment_method = Column(String(30))
    payment_type = Column(Enum("PAYMENT", "REFUND"), nullable=False, default="PAYMENT")
    payment_status = Column(Enum("PENDING", "SUCCESS", "FAILED"), nullable=False, default="PENDING")
    transaction_reference = Column(String(40), nullable=False, unique=True)
    payment_date = Column(DateTime, nullable=False, server_default=func.now())

    booking = relationship("Booking", back_populates="payments")


class Fare(Base):
    __tablename__ = "fares"

    fare_id = Column(BigInteger, primary_key=True, autoincrement=True)
    flight_id = Column(BigInteger, ForeignKey("flights.flight_id"), nullable=False)
    fare_class = Column(Enum("ECONOMY", "BUSINESS", "FIRST"), nullable=False)
    base_fare = Column(DECIMAL(12, 2), nullable=False)
    currency = Column(CHAR(3), nullable=False, default="INR")
    valid_from = Column(DateTime, nullable=False)
    valid_until = Column(DateTime, nullable=True)

    flight = relationship("Flight", back_populates="fares")


class Cancellation(Base):
    __tablename__ = "cancellations"

    cancellation_id = Column(BigInteger, primary_key=True, autoincrement=True)
    booking_id = Column(BigInteger, ForeignKey("bookings.booking_id"), nullable=False, unique=True)
    cancellation_date = Column(DateTime, nullable=False, server_default=func.now())
    cancellation_reason = Column(String(255))
    refund_amount = Column(DECIMAL(12, 2), nullable=False, default=0.00)

    booking = relationship("Booking", back_populates="cancellation")


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), nullable=False, unique=True)
    email = Column(String(150), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum("ADMIN", "ANALYST"), nullable=False, default="ANALYST")
    created_at = Column(DateTime, server_default=func.now())
