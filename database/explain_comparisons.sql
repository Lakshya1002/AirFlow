-- =====================================================================
-- AIR-FLOW: EXPLAIN COMPARISONS
-- File: database/explain_comparisons.sql
-- =====================================================================
-- Demonstrates the impact of indexes on query performance using EXPLAIN.
-- Each comparison shows:
--   1. The query
--   2. EXPLAIN output BEFORE adding the index (simulated by DROP INDEX)
--   3. EXPLAIN output AFTER adding the index
--   4. Written interpretation of the difference
--
-- NOTE: Run these queries interactively in MySQL Workbench.
--       The DROP/CREATE INDEX statements are for demonstration;
--       in production, all indexes from indexes.sql are always present.
-- =====================================================================

USE air_flow_db;

-- =====================================================================
-- COMPARISON 1: Flight lookups by departure date range
-- Index: idx_flights_departure_status ON flights(departure_time, flight_status)
-- =====================================================================

-- Query: Find all scheduled flights departing in a specific month
-- This is the most common dashboard/analytics query.

-- STEP 1: Drop the index to see the "before" plan
-- DROP INDEX idx_flights_departure_status ON flights;

-- STEP 2: EXPLAIN without index
EXPLAIN
SELECT f.flight_id, f.flight_number, f.departure_time, f.flight_status,
       al.airline_name
FROM flights f
INNER JOIN airlines al ON f.airline_id = al.airline_id
WHERE f.departure_time BETWEEN '2026-06-01' AND '2026-06-30'
  AND f.flight_status = 'SCHEDULED';

/*
INTERPRETATION (without index):
  type: ALL (full table scan on flights)
  rows: scans all ~300-500 flight rows
  Extra: Using where
  The query must examine every row in the flights table and filter
  by departure_time and flight_status.
*/

-- STEP 3: Re-create the index
-- CREATE INDEX idx_flights_departure_status ON flights(departure_time, flight_status);

-- STEP 4: EXPLAIN with index
EXPLAIN
SELECT f.flight_id, f.flight_number, f.departure_time, f.flight_status,
       al.airline_name
FROM flights f
INNER JOIN airlines al ON f.airline_id = al.airline_id
WHERE f.departure_time BETWEEN '2026-06-01' AND '2026-06-30'
  AND f.flight_status = 'SCHEDULED';

/*
INTERPRETATION (with index idx_flights_departure_status):
  type: range (index range scan)
  key: idx_flights_departure_status
  rows: scans only the flights within the date range
  Extra: Using index condition
  The composite index on (departure_time, flight_status) lets MySQL
  jump directly to the date range and further filter by status within
  the index. This reduces I/O from a full table scan to a targeted
  range scan, which is especially significant as the flight table grows.
*/


-- =====================================================================
-- COMPARISON 2: Booking revenue aggregation by flight
-- Index: idx_bookings_flight_date ON bookings(flight_id, booking_date)
-- =====================================================================

-- Query: Total bookings and revenue per flight for a date range

-- STEP 1: Drop the index
-- DROP INDEX idx_bookings_flight_date ON bookings;

-- STEP 2: EXPLAIN without index
EXPLAIN
SELECT b.flight_id,
       COUNT(*) AS booking_count,
       SUM(b.total_amount) AS total_revenue
FROM bookings b
WHERE b.booking_date BETWEEN '2026-05-01' AND '2026-07-31'
GROUP BY b.flight_id;

/*
INTERPRETATION (without index):
  type: ALL (full table scan on bookings)
  rows: scans all ~3000-5000 booking rows
  Extra: Using where; Using temporary; Using filesort
  MySQL must scan every booking, filter by date, create a temporary
  table for the GROUP BY, and sort. With thousands of bookings, this
  creates significant overhead.
*/

-- STEP 3: Re-create the index
-- CREATE INDEX idx_bookings_flight_date ON bookings(flight_id, booking_date);

-- STEP 4: EXPLAIN with index
EXPLAIN
SELECT b.flight_id,
       COUNT(*) AS booking_count,
       SUM(b.total_amount) AS total_revenue
FROM bookings b
WHERE b.booking_date BETWEEN '2026-05-01' AND '2026-07-31'
GROUP BY b.flight_id;

/*
INTERPRETATION (with index idx_bookings_flight_date):
  type: index (index scan)
  key: idx_bookings_flight_date
  rows: reduced row examination
  Extra: Using where; Using index
  The composite index (flight_id, booking_date) allows MySQL to:
  1. Use the index for the GROUP BY on flight_id (avoiding temporary table)
  2. Filter by booking_date within the index
  The index is a "covering index" for flight_id + booking_date,
  though total_amount still requires a table lookup. The GROUP BY
  no longer needs a temporary table or filesort because the index
  is already ordered by flight_id.
*/


-- =====================================================================
-- COMPARISON 3: Payment aggregation for revenue analytics
-- Index: idx_payments_type_status ON payments(payment_type, payment_status)
-- =====================================================================

-- Query: Calculate gross revenue, refunds, and net revenue

-- STEP 1: Drop the index
-- DROP INDEX idx_payments_type_status ON payments;

-- STEP 2: EXPLAIN without index
EXPLAIN
SELECT
    SUM(CASE WHEN p.payment_type = 'PAYMENT' AND p.payment_status = 'SUCCESS'
             THEN p.amount ELSE 0 END) AS gross_revenue,
    SUM(CASE WHEN p.payment_type = 'REFUND'  AND p.payment_status = 'SUCCESS'
             THEN p.amount ELSE 0 END) AS total_refunds,
    SUM(CASE WHEN p.payment_type = 'PAYMENT' AND p.payment_status = 'SUCCESS'
             THEN p.amount ELSE 0 END)
    - SUM(CASE WHEN p.payment_type = 'REFUND' AND p.payment_status = 'SUCCESS'
               THEN p.amount ELSE 0 END) AS net_revenue
FROM payments p;

/*
INTERPRETATION (without index):
  type: ALL (full table scan)
  rows: scans all payment rows
  Extra: (none — aggregate over entire table)
  Every payment row is read to compute the CASE-based SUM aggregates.
  With no index on payment_type or payment_status, MySQL cannot
  skip rows that don't match.
*/

-- STEP 3: Re-create the index
-- CREATE INDEX idx_payments_type_status ON payments(payment_type, payment_status);

-- STEP 4: EXPLAIN with index
EXPLAIN
SELECT
    SUM(CASE WHEN p.payment_type = 'PAYMENT' AND p.payment_status = 'SUCCESS'
             THEN p.amount ELSE 0 END) AS gross_revenue,
    SUM(CASE WHEN p.payment_type = 'REFUND'  AND p.payment_status = 'SUCCESS'
             THEN p.amount ELSE 0 END) AS total_refunds,
    SUM(CASE WHEN p.payment_type = 'PAYMENT' AND p.payment_status = 'SUCCESS'
             THEN p.amount ELSE 0 END)
    - SUM(CASE WHEN p.payment_type = 'REFUND' AND p.payment_status = 'SUCCESS'
               THEN p.amount ELSE 0 END) AS net_revenue
FROM payments p;

/*
INTERPRETATION (with index idx_payments_type_status):
  type: index (full index scan, but narrower than table scan)
  key: idx_payments_type_status
  rows: same number, but read from a smaller index structure
  Extra: Using index (for the CASE conditions)
  Since this query aggregates over ALL payments (no WHERE clause),
  the main benefit is that the index is smaller than the full table
  row. MySQL can scan the index instead of the table data pages.
  For queries WITH a WHERE clause (e.g. only SUCCESS payments),
  the index enables a ref or range scan that skips non-matching rows.

  Additional EXPLAIN for filtered query:
*/

EXPLAIN
SELECT SUM(amount) AS gross_revenue
FROM payments
WHERE payment_type = 'PAYMENT' AND payment_status = 'SUCCESS';

/*
  With the filter, EXPLAIN shows:
  type: ref
  key: idx_payments_type_status
  ref: const, const
  rows: only SUCCESS PAYMENT rows
  This is the real win: the index lets MySQL jump directly to the
  matching rows without scanning FAILED payments or REFUND rows.
*/

