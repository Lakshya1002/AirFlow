-- =====================================================================
-- AIR-FLOW: DATABASE VIEWS
-- File: database/views.sql
-- =====================================================================
-- All analytics views compute metrics IN SQL. The backend simply
-- SELECT * FROM <view> with optional WHERE filters.
--
-- METRIC DEFINITIONS (consistent everywhere):
--   Gross revenue  = SUM(payments WHERE type=PAYMENT AND status=SUCCESS)
--   Refunds        = SUM(payments WHERE type=REFUND  AND status=SUCCESS)
--   Net revenue    = Gross revenue - Refunds
--   Seat occupancy = confirmed_seats / sellable_seats * 100
--     where sellable_seats = total_flight_seats - blocked_seats
--   Cancellation rate = cancelled_bookings / total_bookings * 100
--
-- ANTI-DOUBLE-COUNTING STRATEGY:
--   Pre-aggregate payments and seats in separate CTEs/subqueries
--   BEFORE joining them. Never join payments to booking_seats directly.
-- =====================================================================

USE air_flow_db;

-- =====================================================================
-- VIEW 1: vw_flight_revenue
-- Revenue breakdown per flight: gross, refunds, net, booking counts.
-- Pre-aggregates payments in a CTE to avoid double-counting.
-- =====================================================================
CREATE OR REPLACE VIEW vw_flight_revenue AS
WITH payment_summary AS (
    -- Pre-aggregate payments per booking to prevent multiplication on join
    SELECT
        p.booking_id,
        SUM(CASE WHEN p.payment_type = 'PAYMENT' AND p.payment_status = 'SUCCESS'
                 THEN p.amount ELSE 0 END) AS gross_paid,
        SUM(CASE WHEN p.payment_type = 'REFUND'  AND p.payment_status = 'SUCCESS'
                 THEN p.amount ELSE 0 END) AS refunded
    FROM payments p
    GROUP BY p.booking_id
),
booking_revenue AS (
    -- Aggregate at the flight level
    SELECT
        b.flight_id,
        COUNT(DISTINCT b.booking_id)                     AS total_bookings,
        COUNT(DISTINCT CASE WHEN b.booking_status = 'CONFIRMED'
                            THEN b.booking_id END)       AS confirmed_bookings,
        COUNT(DISTINCT CASE WHEN b.booking_status = 'CANCELLED'
                            THEN b.booking_id END)       AS cancelled_bookings,
        COALESCE(SUM(ps.gross_paid), 0)                  AS gross_revenue,
        COALESCE(SUM(ps.refunded), 0)                    AS total_refunds
    FROM bookings b
    LEFT JOIN payment_summary ps ON ps.booking_id = b.booking_id
    GROUP BY b.flight_id
)
SELECT
    f.flight_id,
    f.flight_number,
    al.airline_name,
    al.airline_code,
    orig.airport_code  AS origin_code,
    dest.airport_code  AS destination_code,
    f.departure_time,
    f.arrival_time,
    f.flight_status,
    COALESCE(br.total_bookings, 0)     AS total_bookings,
    COALESCE(br.confirmed_bookings, 0) AS confirmed_bookings,
    COALESCE(br.cancelled_bookings, 0) AS cancelled_bookings,
    COALESCE(br.gross_revenue, 0)      AS gross_revenue,
    COALESCE(br.total_refunds, 0)      AS total_refunds,
    COALESCE(br.gross_revenue, 0) - COALESCE(br.total_refunds, 0) AS net_revenue
FROM flights f
INNER JOIN airlines al   ON f.airline_id = al.airline_id
INNER JOIN routes r      ON f.route_id = r.route_id
INNER JOIN airports orig ON r.origin_airport_id = orig.airport_id
INNER JOIN airports dest ON r.destination_airport_id = dest.airport_id
LEFT  JOIN booking_revenue br ON br.flight_id = f.flight_id;

-- =====================================================================
-- VIEW 2: vw_seat_occupancy
-- Seat utilization per flight: total, available, booked, blocked,
-- sellable, and occupancy percentage.
-- =====================================================================
CREATE OR REPLACE VIEW vw_seat_occupancy AS
WITH seat_counts AS (
    SELECT
        fs.flight_id,
        COUNT(*)                                                    AS total_seats,
        SUM(CASE WHEN fs.seat_status = 'AVAILABLE' THEN 1 ELSE 0 END) AS available_seats,
        SUM(CASE WHEN fs.seat_status = 'BOOKED'    THEN 1 ELSE 0 END) AS booked_seats,
        SUM(CASE WHEN fs.seat_status = 'BLOCKED'   THEN 1 ELSE 0 END) AS blocked_seats
    FROM flight_seats fs
    GROUP BY fs.flight_id
),
confirmed_seats AS (
    -- Count only CONFIRMED booking_seats (not HELD) for occupancy
    SELECT
        fs.flight_id,
        COUNT(DISTINCT bs.booking_seat_id) AS confirmed_occupied
    FROM booking_seats bs
    INNER JOIN flight_seats fs ON bs.flight_seat_id = fs.flight_seat_id
    WHERE bs.seat_status = 'CONFIRMED'
    GROUP BY fs.flight_id
)
SELECT
    f.flight_id,
    f.flight_number,
    al.airline_name,
    orig.airport_code AS origin_code,
    dest.airport_code AS destination_code,
    f.departure_time,
    f.flight_status,
    sc.total_seats,
    sc.available_seats,
    sc.booked_seats,
    sc.blocked_seats,
    (sc.total_seats - sc.blocked_seats)  AS sellable_seats,
    COALESCE(cs.confirmed_occupied, 0)   AS confirmed_occupied,
    -- Occupancy % = confirmed / sellable * 100 (avoid division by zero)
    CASE
        WHEN (sc.total_seats - sc.blocked_seats) > 0
        THEN ROUND(COALESCE(cs.confirmed_occupied, 0) * 100.0
                    / (sc.total_seats - sc.blocked_seats), 2)
        ELSE 0.00
    END AS occupancy_pct
FROM flights f
INNER JOIN airlines al   ON f.airline_id = al.airline_id
INNER JOIN routes r      ON f.route_id = r.route_id
INNER JOIN airports orig ON r.origin_airport_id = orig.airport_id
INNER JOIN airports dest ON r.destination_airport_id = dest.airport_id
INNER JOIN seat_counts sc ON sc.flight_id = f.flight_id
LEFT  JOIN confirmed_seats cs ON cs.flight_id = f.flight_id;

-- =====================================================================
-- VIEW 3: vw_route_performance
-- Aggregated metrics per route: flights, bookings, revenue, occupancy,
-- cancellation rate.
-- =====================================================================
CREATE OR REPLACE VIEW vw_route_performance AS
WITH route_revenue AS (
    SELECT
        f.route_id,
        COUNT(DISTINCT f.flight_id) AS flight_count,
        fr.total_bookings,
        fr.confirmed_bookings,
        fr.cancelled_bookings,
        fr.gross_revenue,
        fr.total_refunds,
        fr.net_revenue
    FROM flights f
    INNER JOIN vw_flight_revenue fr ON fr.flight_id = f.flight_id
    GROUP BY f.route_id
    -- Note: we re-aggregate from vw_flight_revenue which is already per-flight
),
route_flights_agg AS (
    SELECT
        f.route_id,
        COUNT(DISTINCT f.flight_id)                    AS flight_count,
        SUM(fr.total_bookings)                         AS total_bookings,
        SUM(fr.confirmed_bookings)                     AS confirmed_bookings,
        SUM(fr.cancelled_bookings)                     AS cancelled_bookings,
        SUM(fr.gross_revenue)                          AS gross_revenue,
        SUM(fr.total_refunds)                          AS total_refunds,
        SUM(fr.net_revenue)                            AS net_revenue
    FROM flights f
    INNER JOIN vw_flight_revenue fr ON fr.flight_id = f.flight_id
    GROUP BY f.route_id
),
route_occupancy AS (
    SELECT
        f.route_id,
        ROUND(AVG(so.occupancy_pct), 2) AS avg_occupancy_pct
    FROM flights f
    INNER JOIN vw_seat_occupancy so ON so.flight_id = f.flight_id
    GROUP BY f.route_id
),
route_fares AS (
    SELECT
        f.route_id,
        ROUND(AVG(fa.base_fare), 2) AS avg_fare
    FROM flights f
    INNER JOIN fares fa ON fa.flight_id = f.flight_id
    GROUP BY f.route_id
)
SELECT
    r.route_id,
    orig.airport_code AS origin_code,
    orig.city          AS origin_city,
    dest.airport_code AS destination_code,
    dest.city          AS destination_city,
    r.distance_km,
    COALESCE(rfa.flight_count, 0)      AS flight_count,
    COALESCE(rfa.total_bookings, 0)    AS total_bookings,
    COALESCE(rfa.confirmed_bookings, 0) AS confirmed_bookings,
    COALESCE(rfa.cancelled_bookings, 0) AS cancelled_bookings,
    COALESCE(rfa.gross_revenue, 0)     AS gross_revenue,
    COALESCE(rfa.total_refunds, 0)     AS total_refunds,
    COALESCE(rfa.net_revenue, 0)       AS net_revenue,
    COALESCE(rf.avg_fare, 0)           AS avg_fare,
    COALESCE(ro.avg_occupancy_pct, 0)  AS avg_occupancy_pct,
    -- Cancellation rate
    CASE
        WHEN COALESCE(rfa.total_bookings, 0) > 0
        THEN ROUND(COALESCE(rfa.cancelled_bookings, 0) * 100.0
                    / rfa.total_bookings, 2)
        ELSE 0.00
    END AS cancellation_rate
FROM routes r
INNER JOIN airports orig ON r.origin_airport_id = orig.airport_id
INNER JOIN airports dest ON r.destination_airport_id = dest.airport_id
LEFT  JOIN route_flights_agg rfa ON rfa.route_id = r.route_id
LEFT  JOIN route_occupancy ro    ON ro.route_id  = r.route_id
LEFT  JOIN route_fares rf        ON rf.route_id  = r.route_id;

-- =====================================================================
-- VIEW 4: vw_monthly_revenue
-- Revenue aggregated by year-month with month-over-month growth.
-- Uses window function LAG() for growth calculation.
-- =====================================================================
CREATE OR REPLACE VIEW vw_monthly_revenue AS
WITH monthly_payments AS (
    SELECT
        DATE_FORMAT(p.payment_date, '%Y-%m') AS revenue_month,
        SUM(CASE WHEN p.payment_type = 'PAYMENT' AND p.payment_status = 'SUCCESS'
                 THEN p.amount ELSE 0 END) AS gross_revenue,
        SUM(CASE WHEN p.payment_type = 'REFUND'  AND p.payment_status = 'SUCCESS'
                 THEN p.amount ELSE 0 END) AS total_refunds
    FROM payments p
    GROUP BY DATE_FORMAT(p.payment_date, '%Y-%m')
)
SELECT
    revenue_month,
    gross_revenue,
    total_refunds,
    (gross_revenue - total_refunds) AS net_revenue,
    -- Month-over-month growth using LAG window function
    LAG(gross_revenue - total_refunds) OVER (ORDER BY revenue_month) AS prev_month_net,
    CASE
        WHEN LAG(gross_revenue - total_refunds) OVER (ORDER BY revenue_month) > 0
        THEN ROUND(
            ((gross_revenue - total_refunds)
             - LAG(gross_revenue - total_refunds) OVER (ORDER BY revenue_month))
            * 100.0
            / LAG(gross_revenue - total_refunds) OVER (ORDER BY revenue_month),
            2
        )
        ELSE NULL
    END AS mom_growth_pct
FROM monthly_payments
ORDER BY revenue_month;

-- =====================================================================
-- VIEW 5: vw_booking_summary
-- Detailed booking view with passenger, flight, payment, and seat info.
-- =====================================================================
CREATE OR REPLACE VIEW vw_booking_summary AS
WITH booking_payments AS (
    SELECT
        p.booking_id,
        SUM(CASE WHEN p.payment_type = 'PAYMENT' AND p.payment_status = 'SUCCESS'
                 THEN p.amount ELSE 0 END) AS amount_paid,
        SUM(CASE WHEN p.payment_type = 'REFUND'  AND p.payment_status = 'SUCCESS'
                 THEN p.amount ELSE 0 END) AS amount_refunded,
        MAX(p.payment_method) AS payment_method
    FROM payments p
    GROUP BY p.booking_id
),
booking_seat_info AS (
    SELECT
        bs.booking_id,
        COUNT(*) AS seat_count,
        GROUP_CONCAT(
            CONCAT(acs.seat_number, ' (', acs.seat_class, ')')
            ORDER BY acs.seat_number SEPARATOR ', '
        ) AS seats_assigned
    FROM booking_seats bs
    INNER JOIN flight_seats fs   ON bs.flight_seat_id = fs.flight_seat_id
    INNER JOIN aircraft_seats acs ON fs.aircraft_seat_id = acs.aircraft_seat_id
    WHERE bs.seat_status IN ('HELD', 'CONFIRMED')
    GROUP BY bs.booking_id
)
SELECT
    b.booking_id,
    b.booking_reference,
    p.full_name      AS passenger_name,
    p.email           AS passenger_email,
    f.flight_number,
    al.airline_name,
    orig.airport_code AS origin_code,
    dest.airport_code AS destination_code,
    f.departure_time,
    b.booking_date,
    b.booking_status,
    b.total_amount,
    COALESCE(bp.amount_paid, 0)     AS amount_paid,
    COALESCE(bp.amount_refunded, 0) AS amount_refunded,
    bp.payment_method,
    COALESCE(bsi.seat_count, 0)     AS seat_count,
    bsi.seats_assigned,
    b.booking_metadata
FROM bookings b
INNER JOIN passengers p   ON b.passenger_id = p.passenger_id
INNER JOIN flights f      ON b.flight_id = f.flight_id
INNER JOIN airlines al    ON f.airline_id = al.airline_id
INNER JOIN routes r       ON f.route_id = r.route_id
INNER JOIN airports orig  ON r.origin_airport_id = orig.airport_id
INNER JOIN airports dest  ON r.destination_airport_id = dest.airport_id
LEFT  JOIN booking_payments bp  ON bp.booking_id = b.booking_id
LEFT  JOIN booking_seat_info bsi ON bsi.booking_id = b.booking_id;

