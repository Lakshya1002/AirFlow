-- =====================================================================
-- AIR-FLOW: ANALYTICS QUERIES
-- File: database/analytics_queries.sql
-- =====================================================================
-- This file contains the advanced SQL queries that power the analytics
-- modules. Each query is labelled with the SQL concepts it demonstrates.
--
-- CONCEPTS COVERED:
--   A. SELECT, WHERE, ORDER BY, DISTINCT, LIMIT, INSERT, UPDATE, DELETE
--   B. UPPER, LOWER, CONCAT, LENGTH, ROUND, COALESCE, CASE, IF,
--      DATE_FORMAT, DATEDIFF
--   C. COUNT, SUM, AVG, MIN, MAX
--   D. GROUP BY + HAVING
--   E. INNER JOIN, LEFT JOIN, RIGHT JOIN, SELF JOIN
--   F. Subqueries (scalar, correlated, IN, EXISTS)
--   G. CTEs (WITH clause)
--   H. Window functions (ROW_NUMBER, RANK, DENSE_RANK, LAG, LEAD,
--      SUM OVER, AVG OVER)
--   M. JSON functions (JSON_EXTRACT, JSON_UNQUOTE, ->>, JSON_SET,
--      JSON_CONTAINS)
-- =====================================================================

USE air_flow_db;

-- =====================================================================
-- SECTION A & B: Basic Queries with Functions
-- Concepts: SELECT, WHERE, DISTINCT, ORDER BY, LIMIT, UPPER, CONCAT,
--           ROUND, COALESCE, CASE, IF, DATE_FORMAT, DATEDIFF
-- =====================================================================

-- A1. List all flights with formatted display
-- Concepts: CONCAT, DATE_FORMAT, DATEDIFF, CASE, COALESCE
SELECT
    f.flight_number,
    CONCAT(UPPER(al.airline_code), ' - ', al.airline_name) AS airline_display,
    CONCAT(orig.airport_code, ' → ', dest.airport_code)    AS route_display,
    DATE_FORMAT(f.departure_time, '%d %b %Y %H:%i')         AS departure_formatted,
    DATE_FORMAT(f.arrival_time,   '%d %b %Y %H:%i')         AS arrival_formatted,
    -- Flight duration in hours and minutes
    CONCAT(
        FLOOR(TIMESTAMPDIFF(MINUTE, f.departure_time, f.arrival_time) / 60), 'h ',
        MOD(TIMESTAMPDIFF(MINUTE, f.departure_time, f.arrival_time), 60), 'm'
    ) AS duration,
    CASE f.flight_status
        WHEN 'SCHEDULED' THEN '🟢 Scheduled'
        WHEN 'BOARDING'   THEN '🟡 Boarding'
        WHEN 'COMPLETED'  THEN '✅ Completed'
        WHEN 'CANCELLED'  THEN '🔴 Cancelled'
    END AS status_display,
    COALESCE(r.distance_km, 0) AS distance_km
FROM flights f
INNER JOIN airlines al   ON f.airline_id = al.airline_id
INNER JOIN routes r      ON f.route_id = r.route_id
INNER JOIN airports orig ON r.origin_airport_id = orig.airport_id
INNER JOIN airports dest ON r.destination_airport_id = dest.airport_id
ORDER BY f.departure_time DESC
LIMIT 50;

-- A2. Search passengers with pattern matching
-- Concepts: WHERE, LOWER, LIKE, DISTINCT
SELECT DISTINCT
    p.passenger_id,
    p.full_name,
    LOWER(p.email) AS email_normalized,
    LENGTH(p.phone) AS phone_length,
    IF(p.phone IS NOT NULL, 'Yes', 'No') AS has_phone
FROM passengers p
WHERE LOWER(p.full_name) LIKE '%sharma%'
   OR LOWER(p.email) LIKE '%sharma%'
ORDER BY p.full_name;

-- =====================================================================
-- SECTION C & D: Aggregates with GROUP BY + HAVING
-- Concepts: COUNT, SUM, AVG, MIN, MAX, GROUP BY, HAVING
-- =====================================================================

-- C1. Revenue by airline
-- Concepts: SUM, COUNT, GROUP BY, HAVING
SELECT
    al.airline_name,
    al.airline_code,
    COUNT(DISTINCT b.booking_id) AS total_bookings,
    COUNT(DISTINCT f.flight_id)  AS total_flights,
    SUM(CASE WHEN p.payment_type = 'PAYMENT' AND p.payment_status = 'SUCCESS'
             THEN p.amount ELSE 0 END) AS gross_revenue,
    SUM(CASE WHEN p.payment_type = 'REFUND'  AND p.payment_status = 'SUCCESS'
             THEN p.amount ELSE 0 END) AS total_refunds,
    SUM(CASE WHEN p.payment_type = 'PAYMENT' AND p.payment_status = 'SUCCESS'
             THEN p.amount ELSE 0 END)
    - SUM(CASE WHEN p.payment_type = 'REFUND' AND p.payment_status = 'SUCCESS'
               THEN p.amount ELSE 0 END) AS net_revenue,
    ROUND(AVG(CASE WHEN p.payment_type = 'PAYMENT' AND p.payment_status = 'SUCCESS'
                   THEN p.amount END), 2) AS avg_booking_value,
    MIN(CASE WHEN p.payment_type = 'PAYMENT' AND p.payment_status = 'SUCCESS'
             THEN p.amount END) AS min_payment,
    MAX(CASE WHEN p.payment_type = 'PAYMENT' AND p.payment_status = 'SUCCESS'
             THEN p.amount END) AS max_payment
FROM airlines al
INNER JOIN flights f   ON al.airline_id = f.airline_id
INNER JOIN bookings b  ON f.flight_id = b.flight_id
LEFT  JOIN payments p  ON b.booking_id = p.booking_id
GROUP BY al.airline_id, al.airline_name, al.airline_code
HAVING net_revenue > 0
ORDER BY net_revenue DESC;

-- D1. Routes with occupancy above a threshold (HAVING)
-- Concepts: GROUP BY, HAVING, AVG, subquery in HAVING
SELECT
    CONCAT(orig.airport_code, ' → ', dest.airport_code) AS route,
    orig.city AS origin_city,
    dest.city AS destination_city,
    COUNT(DISTINCT f.flight_id) AS flight_count,
    ROUND(AVG(so.occupancy_pct), 2) AS avg_occupancy
FROM routes r
INNER JOIN airports orig ON r.origin_airport_id = orig.airport_id
INNER JOIN airports dest ON r.destination_airport_id = dest.airport_id
INNER JOIN flights f ON f.route_id = r.route_id
INNER JOIN vw_seat_occupancy so ON so.flight_id = f.flight_id
GROUP BY r.route_id, orig.airport_code, orig.city, dest.airport_code, dest.city
HAVING avg_occupancy > 70
ORDER BY avg_occupancy DESC;

-- D2. Fare class comparison by revenue
-- Concepts: GROUP BY, SUM, COUNT, ROUND
SELECT
    acs.seat_class AS fare_class,
    COUNT(DISTINCT bs.booking_seat_id) AS seats_sold,
    COUNT(DISTINCT b.booking_id) AS bookings,
    SUM(CASE WHEN p.payment_type = 'PAYMENT' AND p.payment_status = 'SUCCESS'
             THEN p.amount ELSE 0 END) AS gross_revenue,
    ROUND(AVG(CASE WHEN p.payment_type = 'PAYMENT' AND p.payment_status = 'SUCCESS'
                   THEN p.amount END), 2) AS avg_fare_paid,
    ROUND(SUM(CASE WHEN p.payment_type = 'PAYMENT' AND p.payment_status = 'SUCCESS'
                   THEN p.amount ELSE 0 END)
          / NULLIF(COUNT(DISTINCT bs.booking_seat_id), 0), 2) AS revenue_per_seat
FROM booking_seats bs
INNER JOIN flight_seats fs     ON bs.flight_seat_id = fs.flight_seat_id
INNER JOIN aircraft_seats acs  ON fs.aircraft_seat_id = acs.aircraft_seat_id
INNER JOIN bookings b          ON bs.booking_id = b.booking_id
LEFT  JOIN payments p          ON b.booking_id = p.booking_id
WHERE bs.seat_status = 'CONFIRMED'
GROUP BY acs.seat_class
ORDER BY FIELD(acs.seat_class, 'FIRST', 'BUSINESS', 'ECONOMY');

-- =====================================================================
-- SECTION E: Joins (INNER, LEFT, RIGHT, SELF)
-- =====================================================================

-- E1. LEFT JOIN: All flights including those with no bookings
-- Concepts: LEFT JOIN showing NULLs
SELECT
    f.flight_number,
    al.airline_name,
    COUNT(DISTINCT b.booking_id) AS booking_count,
    CASE WHEN COUNT(b.booking_id) = 0 THEN 'No Bookings' ELSE 'Has Bookings' END AS status
FROM flights f
INNER JOIN airlines al ON f.airline_id = al.airline_id
LEFT  JOIN bookings b  ON f.flight_id = b.flight_id
GROUP BY f.flight_id, f.flight_number, al.airline_name
ORDER BY booking_count ASC;

-- E2. RIGHT JOIN: All passengers including those without bookings
-- Concepts: RIGHT JOIN
SELECT
    p.full_name,
    p.email,
    COUNT(b.booking_id) AS total_bookings,
    COALESCE(SUM(b.total_amount), 0) AS total_spent
FROM bookings b
RIGHT JOIN passengers p ON b.passenger_id = p.passenger_id
GROUP BY p.passenger_id, p.full_name, p.email
ORDER BY total_bookings DESC;

-- E3. SELF JOIN: Find return/reverse route pairs
-- Concepts: SELF JOIN on routes table
SELECT
    r1.route_id AS outbound_route_id,
    CONCAT(o1.airport_code, ' → ', d1.airport_code) AS outbound_route,
    r2.route_id AS return_route_id,
    CONCAT(o2.airport_code, ' → ', d2.airport_code) AS return_route,
    r1.distance_km
FROM routes r1
INNER JOIN routes r2 ON r1.origin_airport_id = r2.destination_airport_id
                    AND r1.destination_airport_id = r2.origin_airport_id
INNER JOIN airports o1 ON r1.origin_airport_id = o1.airport_id
INNER JOIN airports d1 ON r1.destination_airport_id = d1.airport_id
INNER JOIN airports o2 ON r2.origin_airport_id = o2.airport_id
INNER JOIN airports d2 ON r2.destination_airport_id = d2.airport_id
WHERE r1.route_id < r2.route_id   -- avoid listing both directions
ORDER BY r1.distance_km DESC;

-- =====================================================================
-- SECTION F: Subqueries
-- =====================================================================

-- F1. Flights with revenue above the overall average (scalar subquery)
-- Concepts: Subquery in WHERE, comparison with AVG
SELECT
    fr.flight_number,
    fr.airline_name,
    fr.net_revenue,
    (SELECT ROUND(AVG(net_revenue), 2) FROM vw_flight_revenue) AS overall_avg_revenue
FROM vw_flight_revenue fr
WHERE fr.net_revenue > (
    SELECT AVG(net_revenue) FROM vw_flight_revenue
)
ORDER BY fr.net_revenue DESC;

-- F2. Routes with above-average occupancy (correlated-style via view)
-- Concepts: Subquery in WHERE with AVG
SELECT
    rp.origin_code,
    rp.destination_code,
    rp.avg_occupancy_pct,
    (SELECT ROUND(AVG(avg_occupancy_pct), 2) FROM vw_route_performance) AS avg_all_routes
FROM vw_route_performance rp
WHERE rp.avg_occupancy_pct > (
    SELECT AVG(avg_occupancy_pct) FROM vw_route_performance
)
ORDER BY rp.avg_occupancy_pct DESC;

-- F3. Passengers with more bookings than average (subquery + HAVING)
-- Concepts: Subquery in HAVING
SELECT
    p.full_name,
    p.email,
    COUNT(b.booking_id) AS booking_count
FROM passengers p
INNER JOIN bookings b ON p.passenger_id = b.passenger_id
GROUP BY p.passenger_id, p.full_name, p.email
HAVING COUNT(b.booking_id) > (
    SELECT AVG(booking_cnt)
    FROM (
        SELECT COUNT(booking_id) AS booking_cnt
        FROM bookings
        GROUP BY passenger_id
    ) AS avg_bookings
)
ORDER BY booking_count DESC;

-- F4. Flights with EXISTS check for cancellations
-- Concepts: EXISTS subquery
SELECT
    f.flight_number,
    f.departure_time
FROM flights f
WHERE EXISTS (
    SELECT 1
    FROM bookings b
    INNER JOIN cancellations c ON b.booking_id = c.booking_id
    WHERE b.flight_id = f.flight_id
);

-- =====================================================================
-- SECTION G: CTEs (Common Table Expressions)
-- =====================================================================

-- G1. Multi-stage revenue analysis using CTEs
-- Concepts: CTE, pre-aggregation to prevent double counting
WITH payment_agg AS (
    -- Stage 1: Aggregate payments per booking
    SELECT
        booking_id,
        SUM(CASE WHEN payment_type = 'PAYMENT' AND payment_status = 'SUCCESS'
                 THEN amount ELSE 0 END) AS gross,
        SUM(CASE WHEN payment_type = 'REFUND'  AND payment_status = 'SUCCESS'
                 THEN amount ELSE 0 END) AS refund
    FROM payments
    GROUP BY booking_id
),
flight_revenue AS (
    -- Stage 2: Aggregate at flight level
    SELECT
        b.flight_id,
        SUM(pa.gross)  AS flight_gross,
        SUM(pa.refund) AS flight_refund,
        SUM(pa.gross) - SUM(pa.refund) AS flight_net,
        COUNT(DISTINCT b.booking_id) AS booking_count
    FROM bookings b
    INNER JOIN payment_agg pa ON pa.booking_id = b.booking_id
    GROUP BY b.flight_id
),
airline_totals AS (
    -- Stage 3: Roll up to airline
    SELECT
        f.airline_id,
        SUM(fr.flight_gross)  AS airline_gross,
        SUM(fr.flight_refund) AS airline_refund,
        SUM(fr.flight_net)    AS airline_net,
        SUM(fr.booking_count) AS airline_bookings,
        COUNT(DISTINCT f.flight_id) AS airline_flights
    FROM flights f
    INNER JOIN flight_revenue fr ON fr.flight_id = f.flight_id
    GROUP BY f.airline_id
)
SELECT
    al.airline_name,
    al.airline_code,
    at.airline_flights,
    at.airline_bookings,
    at.airline_gross,
    at.airline_refund,
    at.airline_net,
    ROUND(at.airline_net / NULLIF(at.airline_flights, 0), 2) AS revenue_per_flight,
    ROUND(at.airline_net / NULLIF(at.airline_bookings, 0), 2) AS revenue_per_booking
FROM airline_totals at
INNER JOIN airlines al ON at.airline_id = al.airline_id
ORDER BY at.airline_net DESC;

-- =====================================================================
-- SECTION H: Window Functions
-- =====================================================================

-- H1. Rank flights by net revenue
-- Concepts: ROW_NUMBER, RANK, DENSE_RANK
SELECT
    fr.flight_number,
    fr.airline_name,
    fr.net_revenue,
    ROW_NUMBER() OVER (ORDER BY fr.net_revenue DESC)  AS row_num,
    RANK()       OVER (ORDER BY fr.net_revenue DESC)  AS revenue_rank,
    DENSE_RANK() OVER (ORDER BY fr.net_revenue DESC)  AS dense_revenue_rank
FROM vw_flight_revenue fr
WHERE fr.net_revenue > 0
ORDER BY revenue_rank;

-- H2. Rank routes by occupancy within each airline
-- Concepts: RANK with PARTITION BY
SELECT
    so.airline_name,
    CONCAT(so.origin_code, ' → ', so.destination_code) AS route,
    so.occupancy_pct,
    RANK() OVER (
        PARTITION BY so.airline_name
        ORDER BY so.occupancy_pct DESC
    ) AS occupancy_rank_in_airline
FROM vw_seat_occupancy so
ORDER BY so.airline_name, occupancy_rank_in_airline;

-- H3. Running total of revenue (cumulative sum)
-- Concepts: SUM() OVER with ORDER BY (running total)
SELECT
    mr.revenue_month,
    mr.net_revenue,
    SUM(mr.net_revenue) OVER (ORDER BY mr.revenue_month) AS cumulative_revenue,
    -- Moving average over last 3 months
    ROUND(AVG(mr.net_revenue) OVER (
        ORDER BY mr.revenue_month
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ), 2) AS moving_avg_3m
FROM vw_monthly_revenue mr
ORDER BY mr.revenue_month;

-- H4. Month-over-month revenue comparison using LAG and LEAD
-- Concepts: LAG, LEAD
SELECT
    mr.revenue_month,
    mr.net_revenue,
    LAG(mr.net_revenue, 1) OVER (ORDER BY mr.revenue_month)  AS prev_month_revenue,
    LEAD(mr.net_revenue, 1) OVER (ORDER BY mr.revenue_month) AS next_month_revenue,
    mr.mom_growth_pct,
    CASE
        WHEN mr.mom_growth_pct > 0  THEN '📈 Growth'
        WHEN mr.mom_growth_pct < 0  THEN '📉 Decline'
        WHEN mr.mom_growth_pct = 0  THEN '➡️ Flat'
        ELSE                             '—'
    END AS trend
FROM vw_monthly_revenue mr
ORDER BY mr.revenue_month;

-- H5. Top 5 and bottom 5 flights by revenue
-- Concepts: Window function with ROW_NUMBER for top-N
WITH ranked_flights AS (
    SELECT
        fr.flight_number,
        fr.airline_name,
        fr.net_revenue,
        ROW_NUMBER() OVER (ORDER BY fr.net_revenue DESC) AS rank_top,
        ROW_NUMBER() OVER (ORDER BY fr.net_revenue ASC)  AS rank_bottom
    FROM vw_flight_revenue fr
    WHERE fr.net_revenue > 0
)
SELECT
    flight_number,
    airline_name,
    net_revenue,
    CASE
        WHEN rank_top <= 5    THEN 'TOP 5'
        WHEN rank_bottom <= 5 THEN 'BOTTOM 5'
    END AS category
FROM ranked_flights
WHERE rank_top <= 5 OR rank_bottom <= 5
ORDER BY net_revenue DESC;

-- =====================================================================
-- SECTION M: JSON Functions
-- =====================================================================

-- M1. Bookings by channel (from booking_metadata)
-- Concepts: JSON_EXTRACT, JSON_UNQUOTE, ->> operator
SELECT
    COALESCE(
        b.booking_metadata ->> '$.booking_channel',
        'UNKNOWN'
    ) AS booking_channel,
    COUNT(*) AS booking_count,
    SUM(b.total_amount) AS total_revenue,
    ROUND(AVG(b.total_amount), 2) AS avg_booking_value
FROM bookings b
GROUP BY booking_channel
ORDER BY booking_count DESC;

-- M2. Bookings with specific meal preference (JSON_CONTAINS)
-- Concepts: JSON_CONTAINS
SELECT
    b.booking_reference,
    p.full_name,
    b.booking_metadata ->> '$.meal_preference' AS meal_preference,
    b.booking_metadata ->> '$.baggage_kg'       AS baggage_kg,
    b.booking_metadata ->> '$.booking_channel'  AS channel
FROM bookings b
INNER JOIN passengers p ON b.passenger_id = p.passenger_id
WHERE b.booking_metadata IS NOT NULL
  AND JSON_CONTAINS(b.booking_metadata, '"VEG"', '$.meal_preference')
LIMIT 20;

-- M3. Update metadata with JSON_SET
-- Concepts: JSON_SET (demonstration — does not modify data permanently here)
-- This shows how to add/modify a JSON field:
-- UPDATE bookings
-- SET booking_metadata = JSON_SET(
--     COALESCE(booking_metadata, '{}'),
--     '$.loyalty_points', 150,
--     '$.priority_boarding', true
-- )
-- WHERE booking_id = ?;

-- M4. Analytics by baggage weight tiers (JSON + CASE)
-- Concepts: JSON_EXTRACT + CAST + CASE for derived grouping
SELECT
    CASE
        WHEN CAST(b.booking_metadata ->> '$.baggage_kg' AS UNSIGNED) <= 15 THEN 'Light (≤15kg)'
        WHEN CAST(b.booking_metadata ->> '$.baggage_kg' AS UNSIGNED) <= 25 THEN 'Medium (16-25kg)'
        WHEN CAST(b.booking_metadata ->> '$.baggage_kg' AS UNSIGNED) <= 35 THEN 'Heavy (26-35kg)'
        ELSE 'Extra (>35kg)'
    END AS baggage_tier,
    COUNT(*) AS booking_count,
    ROUND(AVG(b.total_amount), 2) AS avg_fare
FROM bookings b
WHERE b.booking_metadata IS NOT NULL
  AND b.booking_metadata ->> '$.baggage_kg' IS NOT NULL
GROUP BY baggage_tier
ORDER BY booking_count DESC;

-- =====================================================================
-- ADDITIONAL ANALYTICS QUERIES
-- =====================================================================

-- Dashboard KPIs (single query returning all dashboard cards)
-- Concepts: Subqueries, COALESCE, ROUND, COUNT DISTINCT
SELECT
    (SELECT COALESCE(SUM(CASE WHEN payment_type='PAYMENT' AND payment_status='SUCCESS'
                              THEN amount ELSE 0 END)
                   - SUM(CASE WHEN payment_type='REFUND' AND payment_status='SUCCESS'
                              THEN amount ELSE 0 END), 0)
     FROM payments) AS total_net_revenue,

    (SELECT COUNT(*) FROM bookings) AS total_bookings,

    (SELECT COUNT(*) FROM flights) AS total_flights,

    (SELECT ROUND(AVG(occupancy_pct), 2) FROM vw_seat_occupancy) AS avg_occupancy_pct,

    (SELECT COUNT(*) FROM passengers) AS total_passengers,

    (SELECT ROUND(
        COUNT(CASE WHEN booking_status = 'CANCELLED' THEN 1 END) * 100.0
        / NULLIF(COUNT(*), 0), 2)
     FROM bookings) AS cancellation_rate;

-- Revenue by route (for bar chart)
SELECT
    rp.origin_code,
    rp.destination_code,
    CONCAT(rp.origin_code, '-', rp.destination_code) AS route_label,
    rp.net_revenue,
    rp.flight_count,
    rp.avg_occupancy_pct
FROM vw_route_performance rp
WHERE rp.net_revenue > 0
ORDER BY rp.net_revenue DESC
LIMIT 15;

-- Booking status distribution (for pie chart)
SELECT
    booking_status,
    COUNT(*) AS count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM bookings), 2) AS percentage
FROM bookings
GROUP BY booking_status;

-- Cancellation analytics
SELECT
    c.cancellation_reason,
    COUNT(*) AS count,
    SUM(c.refund_amount) AS total_refunded,
    ROUND(AVG(c.refund_amount), 2) AS avg_refund,
    ROUND(AVG(
        TIMESTAMPDIFF(HOUR, b.booking_date, c.cancellation_date)
    ), 1) AS avg_hours_before_cancel
FROM cancellations c
INNER JOIN bookings b ON c.booking_id = b.booking_id
GROUP BY c.cancellation_reason
ORDER BY count DESC;

