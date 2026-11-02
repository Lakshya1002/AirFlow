-- =====================================================================
-- AIR-FLOW: STORED PROCEDURES
-- File: database/procedures.sql
-- =====================================================================
-- All procedures use MySQL 8.0 syntax.
-- Transactional procedures use explicit START TRANSACTION, COMMIT,
-- ROLLBACK and SELECT ... FOR UPDATE for concurrency safety.
-- =====================================================================

USE air_flow_db;

-- =====================================================================
-- PROCEDURE 1: sp_create_flight_seats
-- Creates per-flight seat inventory from the aircraft's seat layout.
-- Called when a new flight is created.
--
-- Parameters:
--   p_flight_id  - the newly created flight
--   p_aircraft_id - the aircraft assigned to the flight
--
-- Logic:
--   1. Verify the flight and aircraft exist.
--   2. Check that seat inventory doesn't already exist for this flight.
--   3. Copy every seat from aircraft_seats into flight_seats as AVAILABLE.
--   4. Optionally block a small random set of seats (e.g. maintenance).
-- =====================================================================
DELIMITER //

CREATE PROCEDURE sp_create_flight_seats(
    IN p_flight_id   BIGINT,
    IN p_aircraft_id INT
)
BEGIN
    DECLARE v_flight_exists INT DEFAULT 0;
    DECLARE v_seats_exist INT DEFAULT 0;
    DECLARE v_seat_count INT DEFAULT 0;

    -- Check flight exists
    SELECT COUNT(*) INTO v_flight_exists
    FROM flights WHERE flight_id = p_flight_id;

    IF v_flight_exists = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Flight does not exist';
    END IF;

    -- Check no seats already generated for this flight
    SELECT COUNT(*) INTO v_seats_exist
    FROM flight_seats WHERE flight_id = p_flight_id;

    IF v_seats_exist > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Flight seats already exist for this flight';
    END IF;

    -- Insert all aircraft seats as AVAILABLE flight seats
    INSERT INTO flight_seats (flight_id, aircraft_seat_id, seat_status)
    SELECT p_flight_id, acs.aircraft_seat_id, 'AVAILABLE'
    FROM aircraft_seats acs
    WHERE acs.aircraft_id = p_aircraft_id;

    SELECT ROW_COUNT() INTO v_seat_count;

    IF v_seat_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No seats found for the specified aircraft';
    END IF;

    -- Return a summary
    SELECT
        p_flight_id   AS flight_id,
        v_seat_count  AS seats_created,
        'SUCCESS'     AS status;
END //

DELIMITER ;

-- =====================================================================
-- PROCEDURE 2: sp_flight_revenue_report
-- Returns detailed revenue report for a specific flight.
-- Uses CTEs to pre-aggregate payments (anti-double-counting).
-- =====================================================================
DELIMITER //

CREATE PROCEDURE sp_flight_revenue_report(
    IN p_flight_id BIGINT
)
BEGIN
    WITH payment_agg AS (
        SELECT
            p.booking_id,
            SUM(CASE WHEN p.payment_type = 'PAYMENT' AND p.payment_status = 'SUCCESS'
                     THEN p.amount ELSE 0 END) AS gross_paid,
            SUM(CASE WHEN p.payment_type = 'REFUND'  AND p.payment_status = 'SUCCESS'
                     THEN p.amount ELSE 0 END) AS refunded,
            COUNT(CASE WHEN p.payment_status = 'FAILED' THEN 1 END) AS failed_payments
        FROM payments p
        GROUP BY p.booking_id
    ),
    booking_agg AS (
        SELECT
            b.flight_id,
            COUNT(DISTINCT b.booking_id) AS total_bookings,
            COUNT(DISTINCT CASE WHEN b.booking_status = 'CONFIRMED'
                                THEN b.booking_id END) AS confirmed_bookings,
            COUNT(DISTINCT CASE WHEN b.booking_status = 'CANCELLED'
                                THEN b.booking_id END) AS cancelled_bookings,
            COALESCE(SUM(pa.gross_paid), 0)   AS gross_revenue,
            COALESCE(SUM(pa.refunded), 0)     AS total_refunds,
            COALESCE(SUM(pa.failed_payments), 0) AS total_failed_payments
        FROM bookings b
        LEFT JOIN payment_agg pa ON pa.booking_id = b.booking_id
        WHERE b.flight_id = p_flight_id
        GROUP BY b.flight_id
    )
    SELECT
        f.flight_id,
        f.flight_number,
        al.airline_name,
        orig.airport_code AS origin,
        dest.airport_code AS destination,
        f.departure_time,
        f.flight_status,
        COALESCE(ba.total_bookings, 0)         AS total_bookings,
        COALESCE(ba.confirmed_bookings, 0)     AS confirmed_bookings,
        COALESCE(ba.cancelled_bookings, 0)     AS cancelled_bookings,
        COALESCE(ba.gross_revenue, 0)          AS gross_revenue,
        COALESCE(ba.total_refunds, 0)          AS total_refunds,
        COALESCE(ba.gross_revenue, 0) - COALESCE(ba.total_refunds, 0) AS net_revenue,
        COALESCE(ba.total_failed_payments, 0)  AS failed_payments,
        CASE
            WHEN COALESCE(ba.total_bookings, 0) > 0
            THEN ROUND(COALESCE(ba.cancelled_bookings, 0) * 100.0 / ba.total_bookings, 2)
            ELSE 0.00
        END AS cancellation_rate
    FROM flights f
    INNER JOIN airlines al   ON f.airline_id = al.airline_id
    INNER JOIN routes r      ON f.route_id = r.route_id
    INNER JOIN airports orig ON r.origin_airport_id = orig.airport_id
    INNER JOIN airports dest ON r.destination_airport_id = dest.airport_id
    LEFT  JOIN booking_agg ba ON ba.flight_id = f.flight_id
    WHERE f.flight_id = p_flight_id;
END //

DELIMITER ;

-- =====================================================================
-- PROCEDURE 3: sp_route_performance_report
-- Returns performance metrics for a specific route.
-- =====================================================================
DELIMITER //

CREATE PROCEDURE sp_route_performance_report(
    IN p_route_id INT
)
BEGIN
    SELECT *
    FROM vw_route_performance
    WHERE route_id = p_route_id;
END //

DELIMITER ;

-- =====================================================================
-- PROCEDURE 4: sp_calculate_flight_occupancy
-- Returns detailed seat occupancy for a specific flight.
-- =====================================================================
DELIMITER //

CREATE PROCEDURE sp_calculate_flight_occupancy(
    IN p_flight_id BIGINT
)
BEGIN
    -- Seat counts by class
    SELECT
        acs.seat_class,
        COUNT(*) AS total_seats,
        SUM(CASE WHEN fs.seat_status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available,
        SUM(CASE WHEN fs.seat_status = 'BOOKED'    THEN 1 ELSE 0 END) AS booked,
        SUM(CASE WHEN fs.seat_status = 'BLOCKED'   THEN 1 ELSE 0 END) AS blocked,
        -- Sellable = total - blocked
        COUNT(*) - SUM(CASE WHEN fs.seat_status = 'BLOCKED' THEN 1 ELSE 0 END) AS sellable,
        -- Confirmed occupied (from booking_seats, CONFIRMED only)
        (
            SELECT COUNT(*)
            FROM booking_seats bs2
            INNER JOIN flight_seats fs2 ON bs2.flight_seat_id = fs2.flight_seat_id
            INNER JOIN aircraft_seats acs2 ON fs2.aircraft_seat_id = acs2.aircraft_seat_id
            WHERE fs2.flight_id = p_flight_id
              AND acs2.seat_class = acs.seat_class
              AND bs2.seat_status = 'CONFIRMED'
        ) AS confirmed_occupied,
        -- Occupancy %
        CASE
            WHEN (COUNT(*) - SUM(CASE WHEN fs.seat_status = 'BLOCKED' THEN 1 ELSE 0 END)) > 0
            THEN ROUND(
                (SELECT COUNT(*)
                 FROM booking_seats bs3
                 INNER JOIN flight_seats fs3 ON bs3.flight_seat_id = fs3.flight_seat_id
                 INNER JOIN aircraft_seats acs3 ON fs3.aircraft_seat_id = acs3.aircraft_seat_id
                 WHERE fs3.flight_id = p_flight_id
                   AND acs3.seat_class = acs.seat_class
                   AND bs3.seat_status = 'CONFIRMED')
                * 100.0
                / (COUNT(*) - SUM(CASE WHEN fs.seat_status = 'BLOCKED' THEN 1 ELSE 0 END)),
                2
            )
            ELSE 0.00
        END AS occupancy_pct
    FROM flight_seats fs
    INNER JOIN aircraft_seats acs ON fs.aircraft_seat_id = acs.aircraft_seat_id
    WHERE fs.flight_id = p_flight_id
    GROUP BY acs.seat_class
    ORDER BY FIELD(acs.seat_class, 'FIRST', 'BUSINESS', 'ECONOMY');
END //

DELIMITER ;

-- =====================================================================
-- PROCEDURE 5: sp_process_booking
-- Creates a booking with seat holds and simulated payment.
-- Full transactional flow with row-level locking.
--
-- Parameters:
--   p_passenger_id    - passenger making the booking
--   p_flight_id       - flight to book
--   p_seat_ids        - comma-separated flight_seat_ids (e.g. '10,11,12')
--   p_payment_method  - payment method string
--   p_simulate_fail   - if 1, simulates a failed payment (for testing)
--   p_metadata        - JSON string for booking_metadata
--
-- Steps:
--   1. START TRANSACTION
--   2. Lock requested flight_seats with SELECT ... FOR UPDATE
--   3. Verify all seats are AVAILABLE and belong to this flight
--   4. Create booking as PENDING
--   5. Create booking_seats as HELD
--   6. Calculate fare from fares table
--   7. Process simulated payment
--   8. If SUCCESS: CONFIRMED; if FAILED: record FAILED payment, release
-- =====================================================================
DELIMITER //

CREATE PROCEDURE sp_process_booking(
    IN p_passenger_id   INT,
    IN p_flight_id      BIGINT,
    IN p_seat_ids       TEXT,        -- comma-separated flight_seat_ids
    IN p_payment_method VARCHAR(30),
    IN p_simulate_fail  TINYINT,     -- 0=success, 1=simulate failure
    IN p_metadata       JSON
)
proc_label: BEGIN
    DECLARE v_booking_id BIGINT;
    DECLARE v_booking_ref VARCHAR(10);
    DECLARE v_total_fare DECIMAL(12,2) DEFAULT 0;
    DECLARE v_available_count INT DEFAULT 0;
    DECLARE v_requested_count INT DEFAULT 0;
    DECLARE v_txn_ref VARCHAR(40);
    DECLARE v_payment_id BIGINT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    -- Generate a unique booking reference: AF- + 6 random hex chars
    SET v_booking_ref = CONCAT('AF-', UPPER(SUBSTRING(MD5(RAND()), 1, 6)));

    -- Count requested seats
    SET v_requested_count = (LENGTH(p_seat_ids) - LENGTH(REPLACE(p_seat_ids, ',', '')) + 1);

    START TRANSACTION;

    -- Step 1: Lock the requested seats (SELECT ... FOR UPDATE)
    -- and verify they are AVAILABLE and belong to the right flight
    SELECT COUNT(*) INTO v_available_count
    FROM flight_seats
    WHERE flight_id = p_flight_id
      AND seat_status = 'AVAILABLE'
      AND FIND_IN_SET(flight_seat_id, p_seat_ids) > 0
    FOR UPDATE;

    IF v_available_count <> v_requested_count THEN
        ROLLBACK;
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'One or more seats are not available for booking';
    END IF;

    -- Step 2: Calculate total fare from fares table
    SELECT COALESCE(SUM(fa.base_fare), 0) INTO v_total_fare
    FROM flight_seats fs
    INNER JOIN aircraft_seats acs ON fs.aircraft_seat_id = acs.aircraft_seat_id
    INNER JOIN fares fa ON fa.flight_id = fs.flight_id
                       AND fa.fare_class = acs.seat_class
                       AND CURDATE() BETWEEN fa.valid_from
                                         AND COALESCE(fa.valid_until, '9999-12-31')
    WHERE FIND_IN_SET(fs.flight_seat_id, p_seat_ids) > 0;

    IF v_total_fare = 0 THEN
        -- Fallback: use a default fare if none configured
        SET v_total_fare = v_requested_count * 5000.00;
    END IF;

    -- Step 3: Create the booking as PENDING
    INSERT INTO bookings (booking_reference, passenger_id, flight_id, booking_date,
                          booking_status, total_amount, booking_metadata)
    VALUES (v_booking_ref, p_passenger_id, p_flight_id, NOW(),
            'PENDING', v_total_fare, p_metadata);

    SET v_booking_id = LAST_INSERT_ID();

    -- Step 4: Update flight_seats to BOOKED and create booking_seats as HELD
    UPDATE flight_seats
    SET seat_status = 'BOOKED'
    WHERE FIND_IN_SET(flight_seat_id, p_seat_ids) > 0
      AND flight_id = p_flight_id;

    -- Insert booking_seats as HELD
    INSERT INTO booking_seats (booking_id, flight_seat_id, seat_status)
    SELECT v_booking_id, fs.flight_seat_id, 'HELD'
    FROM flight_seats fs
    WHERE FIND_IN_SET(fs.flight_seat_id, p_seat_ids) > 0
      AND fs.flight_id = p_flight_id;

    -- Step 5: Generate transaction reference
    SET v_txn_ref = CONCAT('TXN-', UPPER(SUBSTRING(MD5(CONCAT(v_booking_id, NOW(), RAND())), 1, 12)));

    -- Step 6: Process payment (simulated)
    IF p_simulate_fail = 0 THEN
        -- Successful payment
        INSERT INTO payments (booking_id, amount, payment_method, payment_type,
                              payment_status, transaction_reference, payment_date)
        VALUES (v_booking_id, v_total_fare, p_payment_method, 'PAYMENT',
                'SUCCESS', v_txn_ref, NOW());

        -- Confirm the booking
        UPDATE bookings
        SET booking_status = 'CONFIRMED'
        WHERE booking_id = v_booking_id;

        -- Confirm the seat assignments
        UPDATE booking_seats
        SET seat_status = 'CONFIRMED'
        WHERE booking_id = v_booking_id;

    ELSE
        -- Failed payment: record the failed payment for analytics
        INSERT INTO payments (booking_id, amount, payment_method, payment_type,
                              payment_status, transaction_reference, payment_date)
        VALUES (v_booking_id, v_total_fare, p_payment_method, 'PAYMENT',
                'FAILED', v_txn_ref, NOW());

        -- Release the seats
        UPDATE flight_seats
        SET seat_status = 'AVAILABLE'
        WHERE FIND_IN_SET(flight_seat_id, p_seat_ids) > 0
          AND flight_id = p_flight_id;

        -- Cancel the seat assignments
        UPDATE booking_seats
        SET seat_status = 'CANCELLED'
        WHERE booking_id = v_booking_id;

        -- Cancel the booking
        UPDATE bookings
        SET booking_status = 'CANCELLED'
        WHERE booking_id = v_booking_id;
    END IF;

    COMMIT;

    -- Return the result
    SELECT
        v_booking_id    AS booking_id,
        v_booking_ref   AS booking_reference,
        v_total_fare    AS total_amount,
        CASE WHEN p_simulate_fail = 0 THEN 'CONFIRMED' ELSE 'CANCELLED' END AS booking_status,
        CASE WHEN p_simulate_fail = 0 THEN 'SUCCESS'   ELSE 'FAILED'   END AS payment_status,
        v_txn_ref       AS transaction_reference;
END //

DELIMITER ;

-- =====================================================================
-- PROCEDURE 6: sp_process_cancellation
-- Cancels a confirmed booking, computes refund based on time-before-
-- departure tiers, records the cancellation and refund payment.
--
-- Refund policy (demo, configurable):
--   > 72 hours before departure: 90% refund
--   24-72 hours: 70% refund
--   12-24 hours: 50% refund
--   < 12 hours: 25% refund
--   After departure: no refund
-- =====================================================================
DELIMITER //

CREATE PROCEDURE sp_process_cancellation(
    IN p_booking_id         BIGINT,
    IN p_cancellation_reason VARCHAR(255)
)
BEGIN
    DECLARE v_booking_status VARCHAR(20);
    DECLARE v_flight_id BIGINT;
    DECLARE v_total_paid DECIMAL(12,2) DEFAULT 0;
    DECLARE v_departure DATETIME;
    DECLARE v_hours_before DECIMAL(10,2);
    DECLARE v_refund_pct DECIMAL(5,2);
    DECLARE v_refund_amount DECIMAL(12,2);
    DECLARE v_txn_ref VARCHAR(40);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    -- Validate booking exists and is CONFIRMED
    SELECT b.booking_status, b.flight_id
    INTO v_booking_status, v_flight_id
    FROM bookings b
    WHERE b.booking_id = p_booking_id;

    IF v_booking_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Booking not found';
    END IF;

    IF v_booking_status <> 'CONFIRMED' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Only CONFIRMED bookings can be cancelled';
    END IF;

    -- Check if already cancelled (cancellations table has UNIQUE on booking_id)
    IF EXISTS (SELECT 1 FROM cancellations WHERE booking_id = p_booking_id) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Booking is already cancelled';
    END IF;

    START TRANSACTION;

    -- Get total amount paid (successful payments only)
    SELECT COALESCE(SUM(p.amount), 0) INTO v_total_paid
    FROM payments p
    WHERE p.booking_id = p_booking_id
      AND p.payment_type = 'PAYMENT'
      AND p.payment_status = 'SUCCESS';

    -- Get departure time
    SELECT f.departure_time INTO v_departure
    FROM flights f WHERE f.flight_id = v_flight_id;

    -- Calculate hours before departure
    SET v_hours_before = TIMESTAMPDIFF(MINUTE, NOW(), v_departure) / 60.0;

    -- Determine refund percentage based on time-before-departure tiers
    SET v_refund_pct = CASE
        WHEN v_hours_before <= 0  THEN 0.00    -- after departure
        WHEN v_hours_before < 12  THEN 25.00
        WHEN v_hours_before < 24  THEN 50.00
        WHEN v_hours_before < 72  THEN 70.00
        ELSE                           90.00   -- > 72 hours
    END;

    SET v_refund_amount = ROUND(v_total_paid * v_refund_pct / 100, 2);

    -- 1. Cancel the booking
    UPDATE bookings
    SET booking_status = 'CANCELLED'
    WHERE booking_id = p_booking_id;

    -- 2. Cancel all active booking_seats and release flight_seats
    UPDATE booking_seats
    SET seat_status = 'CANCELLED'
    WHERE booking_id = p_booking_id
      AND seat_status IN ('HELD', 'CONFIRMED');

    -- Release the corresponding flight_seats back to AVAILABLE
    UPDATE flight_seats fs
    INNER JOIN booking_seats bs ON fs.flight_seat_id = bs.flight_seat_id
    SET fs.seat_status = 'AVAILABLE'
    WHERE bs.booking_id = p_booking_id;

    -- 3. Record the cancellation
    INSERT INTO cancellations (booking_id, cancellation_date, cancellation_reason, refund_amount)
    VALUES (p_booking_id, NOW(), p_cancellation_reason, v_refund_amount);

    -- 4. Record the refund payment (if any refund due)
    IF v_refund_amount > 0 THEN
        SET v_txn_ref = CONCAT('REF-', UPPER(SUBSTRING(MD5(CONCAT(p_booking_id, NOW(), RAND())), 1, 12)));

        INSERT INTO payments (booking_id, amount, payment_method, payment_type,
                              payment_status, transaction_reference, payment_date)
        VALUES (p_booking_id, v_refund_amount,
                (SELECT MAX(payment_method) FROM payments WHERE booking_id = p_booking_id AND payment_type = 'PAYMENT'),
                'REFUND', 'SUCCESS', v_txn_ref, NOW());
    END IF;

    COMMIT;

    -- Return result
    SELECT
        p_booking_id     AS booking_id,
        'CANCELLED'      AS booking_status,
        v_total_paid     AS amount_paid,
        v_hours_before   AS hours_before_departure,
        v_refund_pct     AS refund_percentage,
        v_refund_amount  AS refund_amount;
END //

DELIMITER ;

-- =====================================================================
-- PROCEDURE 7: sp_release_expired_holds
-- Manual trigger for releasing expired held seats (complement to EVENT).
-- Can be called from backend as a cron-like fallback.
-- =====================================================================
DELIMITER //

CREATE PROCEDURE sp_release_expired_holds()
BEGIN
    DECLARE v_released INT DEFAULT 0;

    START TRANSACTION;

    -- Cancel expired held booking_seats
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

    SET v_released = ROW_COUNT();

    -- Release corresponding flight_seats
    UPDATE flight_seats fs
    SET fs.seat_status = 'AVAILABLE'
    WHERE fs.seat_status = 'BOOKED'
      AND NOT EXISTS (
          SELECT 1 FROM booking_seats bs
          WHERE bs.flight_seat_id = fs.flight_seat_id
            AND bs.seat_status IN ('HELD', 'CONFIRMED')
      );

    -- Cancel orphaned PENDING bookings
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

    COMMIT;

    SELECT v_released AS seats_released, 'SUCCESS' AS status;
END //

DELIMITER ;

