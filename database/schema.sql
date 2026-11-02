-- =====================================================================
-- AIR-FLOW: DATABASE SCHEMA
-- File: database/schema.sql
-- Database: air_flow_db (MySQL 8.0+)
-- =====================================================================
-- 14 tables: 13 core domain tables + 1 users table for authentication.
-- If triggers require an audit_log, it is added in triggers.sql as a
-- supporting (15th) table.
--
-- Conventions:
--   PK = AUTO_INCREMENT integer (BIGINT for high-volume tables)
--   Timestamps default to CURRENT_TIMESTAMP
--   ENUMs enforce allowed values at the database level
--   CHECK constraints enforce business rules (MySQL 8.0.16+)
--   Generated columns + UNIQUE constraints prevent double-booking
-- =====================================================================

CREATE DATABASE IF NOT EXISTS air_flow_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE air_flow_db;

-- =====================================================================
-- TABLE 1: airlines
-- Stores airline companies operating flights.
-- =====================================================================
CREATE TABLE airlines (
    airline_id   INT AUTO_INCREMENT PRIMARY KEY,
    airline_name VARCHAR(100) NOT NULL,
    airline_code VARCHAR(5)   NOT NULL UNIQUE,  -- IATA/ICAO style code
    country      VARCHAR(60),
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =====================================================================
-- TABLE 2: airports
-- Stores airports with their IATA codes and locations.
-- =====================================================================
CREATE TABLE airports (
    airport_id   INT AUTO_INCREMENT PRIMARY KEY,
    airport_code CHAR(3)      NOT NULL UNIQUE,  -- IATA code (DEL, BOM, etc.)
    airport_name VARCHAR(150) NOT NULL,
    city         VARCHAR(80),
    country      VARCHAR(60)
) ENGINE=InnoDB;

-- =====================================================================
-- TABLE 3: aircraft
-- Fleet of aircraft, each belonging to one airline.
-- =====================================================================
CREATE TABLE aircraft (
    aircraft_id         INT AUTO_INCREMENT PRIMARY KEY,
    airline_id          INT          NOT NULL,
    registration_number VARCHAR(20)  NOT NULL UNIQUE,  -- e.g. VT-ABC
    model               VARCHAR(80)  NOT NULL,
    total_capacity      INT          NOT NULL,

    CONSTRAINT fk_aircraft_airline
        FOREIGN KEY (airline_id) REFERENCES airlines(airline_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT chk_aircraft_capacity
        CHECK (total_capacity > 0)
) ENGINE=InnoDB;

-- =====================================================================
-- TABLE 4: aircraft_seats
-- Permanent seat layout for each aircraft.
-- Each seat has a class (ECONOMY, BUSINESS, FIRST).
-- A given aircraft cannot have duplicate seat numbers.
-- =====================================================================
CREATE TABLE aircraft_seats (
    aircraft_seat_id INT AUTO_INCREMENT PRIMARY KEY,
    aircraft_id      INT         NOT NULL,
    seat_number      VARCHAR(5)  NOT NULL,  -- e.g. 1A, 12F
    seat_class       ENUM('ECONOMY', 'BUSINESS', 'FIRST') NOT NULL,

    CONSTRAINT fk_seat_aircraft
        FOREIGN KEY (aircraft_id) REFERENCES aircraft(aircraft_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT uq_aircraft_seat
        UNIQUE (aircraft_id, seat_number)
) ENGINE=InnoDB;

-- =====================================================================
-- TABLE 5: routes
-- Origin-destination airport pairs with distance.
-- A route cannot have the same origin and destination.
-- =====================================================================
CREATE TABLE routes (
    route_id              INT AUTO_INCREMENT PRIMARY KEY,
    origin_airport_id     INT            NOT NULL,
    destination_airport_id INT           NOT NULL,
    distance_km           DECIMAL(10, 2),

    CONSTRAINT fk_route_origin
        FOREIGN KEY (origin_airport_id) REFERENCES airports(airport_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_route_destination
        FOREIGN KEY (destination_airport_id) REFERENCES airports(airport_id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_route_different_airports
        CHECK (origin_airport_id <> destination_airport_id)
) ENGINE=InnoDB;

-- =====================================================================
-- TABLE 6: flights
-- Scheduled flights linking airline, aircraft, and route.
-- arrival_time must be after departure_time.
-- =====================================================================
CREATE TABLE flights (
    flight_id       BIGINT AUTO_INCREMENT PRIMARY KEY,
    airline_id      INT          NOT NULL,
    aircraft_id     INT          NOT NULL,
    route_id        INT          NOT NULL,
    flight_number   VARCHAR(10)  NOT NULL,  -- e.g. AI-101
    departure_time  DATETIME     NOT NULL,
    arrival_time    DATETIME     NOT NULL,
    flight_status   ENUM('SCHEDULED', 'BOARDING', 'COMPLETED', 'CANCELLED')
                    NOT NULL DEFAULT 'SCHEDULED',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_flight_airline
        FOREIGN KEY (airline_id) REFERENCES airlines(airline_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT fk_flight_aircraft
        FOREIGN KEY (aircraft_id) REFERENCES aircraft(aircraft_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT fk_flight_route
        FOREIGN KEY (route_id) REFERENCES routes(route_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT chk_flight_times
        CHECK (arrival_time > departure_time)
) ENGINE=InnoDB;

-- =====================================================================
-- TABLE 7: flight_seats
-- Per-flight seat inventory, initialized from aircraft_seats when a
-- flight is created (via stored procedure sp_create_flight_seats).
-- Each row represents one physical seat on one specific flight.
-- =====================================================================
CREATE TABLE flight_seats (
    flight_seat_id  BIGINT AUTO_INCREMENT PRIMARY KEY,
    flight_id       BIGINT NOT NULL,
    aircraft_seat_id INT   NOT NULL,
    seat_status     ENUM('AVAILABLE', 'BOOKED', 'BLOCKED')
                    NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT fk_fseat_flight
        FOREIGN KEY (flight_id) REFERENCES flights(flight_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT fk_fseat_aircraft_seat
        FOREIGN KEY (aircraft_seat_id) REFERENCES aircraft_seats(aircraft_seat_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    -- Each aircraft seat appears exactly once per flight
    CONSTRAINT uq_flight_aircraft_seat
        UNIQUE (flight_id, aircraft_seat_id)
) ENGINE=InnoDB;

-- =====================================================================
-- TABLE 8: passengers
-- Passenger directory. Email is unique identifier.
-- =====================================================================
CREATE TABLE passengers (
    passenger_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name    VARCHAR(120) NOT NULL,
    email        VARCHAR(150) NOT NULL UNIQUE,
    phone        VARCHAR(20),
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =====================================================================
-- TABLE 9: bookings
-- Booking records linking a passenger to a flight.
-- total_amount is the fare charged for the booking.
-- booking_metadata stores optional extras as JSON (meal, baggage, channel).
-- =====================================================================
CREATE TABLE bookings (
    booking_id        BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_reference VARCHAR(10) NOT NULL UNIQUE,  -- e.g. AF-XXXXXX
    passenger_id      INT         NOT NULL,
    flight_id         BIGINT      NOT NULL,
    booking_date      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    booking_status    ENUM('PENDING', 'CONFIRMED', 'CANCELLED')
                      NOT NULL DEFAULT 'PENDING',
    total_amount      DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    booking_metadata  JSON,

    CONSTRAINT fk_booking_passenger
        FOREIGN KEY (passenger_id) REFERENCES passengers(passenger_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT fk_booking_flight
        FOREIGN KEY (flight_id) REFERENCES flights(flight_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT chk_booking_amount
        CHECK (total_amount >= 0)
) ENGINE=InnoDB;

-- =====================================================================
-- TABLE 10: booking_seats
-- Links bookings to specific flight seats.
-- Status flow: HELD → CONFIRMED (on successful payment)
--              HELD → CANCELLED (on failed payment or timeout)
--              CONFIRMED → CANCELLED (on cancellation)
--
-- The generated column `active_seat_lock` is NOT NULL only for HELD
-- and CONFIRMED rows. Combined with the UNIQUE constraint on
-- (flight_seat_id, active_seat_lock), this ensures a flight seat can
-- have at most ONE active (non-cancelled) assignment at any time.
-- Cancelled rows have NULL in the generated column and are excluded
-- from the uniqueness check (MySQL allows multiple NULLs in UNIQUE).
-- =====================================================================
CREATE TABLE booking_seats (
    booking_seat_id  BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_id       BIGINT NOT NULL,
    flight_seat_id   BIGINT NOT NULL,
    seat_status      ENUM('HELD', 'CONFIRMED', 'CANCELLED')
                     NOT NULL DEFAULT 'HELD',

    -- Generated column: non-NULL only for active (HELD/CONFIRMED) seats
    active_seat_lock BIGINT AS (
        CASE WHEN seat_status IN ('HELD', 'CONFIRMED')
             THEN flight_seat_id
             ELSE NULL
        END
    ) STORED,

    CONSTRAINT fk_bseat_booking
        FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_bseat_flight_seat
        FOREIGN KEY (flight_seat_id) REFERENCES flight_seats(flight_seat_id)
        ON DELETE RESTRICT,

    -- Prevents double-booking: only one HELD or CONFIRMED row per flight seat
    CONSTRAINT uq_active_seat
        UNIQUE (flight_seat_id, active_seat_lock)
) ENGINE=InnoDB;

-- =====================================================================
-- TABLE 11: payments
-- Payment and refund transactions.
-- payment_type distinguishes charges from refunds.
-- Both successful and failed payments are recorded for analytics.
-- =====================================================================
CREATE TABLE payments (
    payment_id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_id            BIGINT         NOT NULL,
    amount                DECIMAL(12, 2) NOT NULL,
    payment_method        VARCHAR(30),                -- e.g. CREDIT_CARD, UPI, NET_BANKING
    payment_type          ENUM('PAYMENT', 'REFUND') NOT NULL DEFAULT 'PAYMENT',
    payment_status        ENUM('PENDING', 'SUCCESS', 'FAILED')
                          NOT NULL DEFAULT 'PENDING',
    transaction_reference VARCHAR(40)    NOT NULL UNIQUE,  -- unique txn ID
    payment_date          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_payment_booking
        FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT chk_payment_amount
        CHECK (amount > 0)
) ENGINE=InnoDB;

-- =====================================================================
-- TABLE 12: fares
-- Fare schedule by flight, class, and validity period.
-- Supports historical fares via valid_from / valid_until dates.
-- Overlapping validity periods for the same flight + fare_class
-- are prevented by application logic (MySQL CHECK cannot do range
-- overlap; a trigger or stored procedure validates before insert).
-- =====================================================================
CREATE TABLE fares (
    fare_id    BIGINT AUTO_INCREMENT PRIMARY KEY,
    flight_id  BIGINT         NOT NULL,
    fare_class ENUM('ECONOMY', 'BUSINESS', 'FIRST') NOT NULL,
    base_fare  DECIMAL(12, 2) NOT NULL,
    currency   CHAR(3)        NOT NULL DEFAULT 'INR',
    valid_from DATE           NOT NULL,
    valid_until DATE          NULL,  -- NULL means open-ended

    CONSTRAINT fk_fare_flight
        FOREIGN KEY (flight_id) REFERENCES flights(flight_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT chk_fare_positive
        CHECK (base_fare > 0),

    CONSTRAINT chk_fare_validity
        CHECK (valid_until IS NULL OR valid_until >= valid_from)
) ENGINE=InnoDB;

-- =====================================================================
-- TABLE 13: cancellations
-- Records cancellation details and computed refund amount.
-- One cancellation per booking (UNIQUE on booking_id).
-- The actual refund payment is a separate row in the payments table
-- with payment_type = 'REFUND'.
-- =====================================================================
CREATE TABLE cancellations (
    cancellation_id     BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_id          BIGINT       NOT NULL UNIQUE,
    cancellation_date   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancellation_reason VARCHAR(255),
    refund_amount       DECIMAL(12, 2) NOT NULL DEFAULT 0.00,

    CONSTRAINT fk_cancel_booking
        FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT chk_refund_nonneg
        CHECK (refund_amount >= 0)
) ENGINE=InnoDB;

-- =====================================================================
-- TABLE 14: users
-- Authentication table for ADMIN and ANALYST roles.
-- Supporting table for the application login system.
-- =====================================================================
CREATE TABLE users (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('ADMIN', 'ANALYST') NOT NULL DEFAULT 'ANALYST',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =====================================================================
-- MYSQL EVENT: Release expired held seats
-- Seats in HELD status for more than 15 minutes are released.
-- Requires: SET GLOBAL event_scheduler = ON;
-- =====================================================================
DELIMITER //

CREATE EVENT IF NOT EXISTS evt_release_expired_holds
ON SCHEDULE EVERY 1 MINUTE
STARTS CURRENT_TIMESTAMP
DO
BEGIN
    -- Find bookings with HELD seats older than 15 minutes that are still PENDING
    -- and have no successful payment
    UPDATE booking_seats bs
    INNER JOIN bookings b ON bs.booking_id = b.booking_id
    SET bs.seat_status = 'CANCELLED'
    WHERE bs.seat_status = 'HELD'
      AND b.booking_status = 'PENDING'
      AND b.booking_date < DATE_SUB(NOW(), INTERVAL 15 MINUTE)
      AND NOT EXISTS (
          SELECT 1 FROM payments p
          WHERE p.booking_id = b.booking_id
            AND p.payment_status = 'SUCCESS'
            AND p.payment_type = 'PAYMENT'
      );

    -- Update the corresponding flight_seats back to AVAILABLE
    UPDATE flight_seats fs
    SET fs.seat_status = 'AVAILABLE'
    WHERE fs.seat_status = 'BOOKED'
      AND NOT EXISTS (
          SELECT 1 FROM booking_seats bs
          WHERE bs.flight_seat_id = fs.flight_seat_id
            AND bs.seat_status IN ('HELD', 'CONFIRMED')
      );

    -- Cancel the orphaned PENDING bookings
    UPDATE bookings b
    SET b.booking_status = 'CANCELLED'
    WHERE b.booking_status = 'PENDING'
      AND b.booking_date < DATE_SUB(NOW(), INTERVAL 15 MINUTE)
      AND NOT EXISTS (
          SELECT 1 FROM payments p
          WHERE p.booking_id = b.booking_id
            AND p.payment_status = 'SUCCESS'
            AND p.payment_type = 'PAYMENT'
      );
END //

DELIMITER ;
