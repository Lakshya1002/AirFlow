-- =====================================================================
-- AIR-FLOW: PERFORMANCE INDEXES
-- File: database/indexes.sql
-- =====================================================================
-- These indexes accelerate the most common analytical queries.
-- Do NOT add redundant indexes (e.g. MySQL auto-indexes PKs, UNIQUE cols,
-- and FK columns in InnoDB).
--
-- EXPLAIN comparisons for 3 queries are in explain_comparisons.sql.
-- =====================================================================

USE air_flow_db;

-- -----------------------------------------------------------------
-- flights: queries filter heavily by departure_time, route, and status
-- -----------------------------------------------------------------
-- Composite index for date-range + status filtering (dashboard, analytics)
CREATE INDEX idx_flights_departure_status
    ON flights (departure_time, flight_status);

-- Route-based lookups (route analytics, joins)
CREATE INDEX idx_flights_route_id
    ON flights (route_id);

-- Flight status filtering
CREATE INDEX idx_flights_status
    ON flights (flight_status);

-- -----------------------------------------------------------------
-- bookings: queries join on flight_id, filter by date and status
-- -----------------------------------------------------------------
-- Composite: bookings by flight and date (revenue analytics, occupancy)
CREATE INDEX idx_bookings_flight_date
    ON bookings (flight_id, booking_date);

-- Passenger lookup (passenger booking history)
CREATE INDEX idx_bookings_passenger_id
    ON bookings (passenger_id);

-- Status filtering (cancellation rate, active bookings)
CREATE INDEX idx_bookings_status
    ON bookings (booking_status);

-- -----------------------------------------------------------------
-- flight_seats: per-flight inventory queries
-- -----------------------------------------------------------------
-- Composite: flight + status (seat availability, occupancy calculation)
CREATE INDEX idx_flight_seats_flight_status
    ON flight_seats (flight_id, seat_status);

-- -----------------------------------------------------------------
-- booking_seats: seat assignment lookups
-- -----------------------------------------------------------------
-- Composite: booking + status (booking detail, cancellation processing)
CREATE INDEX idx_booking_seats_booking_status
    ON booking_seats (booking_id, seat_status);

-- -----------------------------------------------------------------
-- payments: revenue analytics, booking payment lookup
-- -----------------------------------------------------------------
-- Composite: booking + status (payment verification, revenue queries)
CREATE INDEX idx_payments_booking_status
    ON payments (booking_id, payment_status);

-- Payment type for revenue vs refund separation
CREATE INDEX idx_payments_type_status
    ON payments (payment_type, payment_status);

-- -----------------------------------------------------------------
-- fares: fare lookup for booking and analytics
-- -----------------------------------------------------------------
-- Composite: flight + class + validity (fare lookup during booking)
CREATE INDEX idx_fares_flight_class_valid
    ON fares (flight_id, fare_class, valid_from);

