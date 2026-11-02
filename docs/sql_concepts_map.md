# AIR-FLOW: Advanced SQL Concepts Map

This document maps every advanced SQL concept required by the course syllabus (21CSE742P, Advanced SQL and Modern Database Features) to its exact location in the codebase, with file references and query descriptions. Use this during the faculty viva demonstration.

---

## Comprehensive Concepts Mapping

| Category | Concept / Feature | Code File | Query / Function / Object | Description / Academic Value |
|---|---|---|---|---|
| **Basics & DDL** | Primary & Foreign Keys with Actions | `database/schema.sql` | All tables | `ON DELETE RESTRICT`, `ON UPDATE CASCADE` across 14 tables |
| **Integrity** | CHECK Constraints | `database/schema.sql` | `aircraft`, `routes`, `flights`, `fares` | Enforces `arrival_time > departure_time`, positive capacity, positive fares, non-negative amounts |
| **Concurrency & Integrity** | Generated Columns + Partial UNIQUE | `database/schema.sql` | `booking_seats.active_seat_lock` | Enforces single active (HELD/CONFIRMED) assignment per seat while preserving full history of CANCELLED seats |
| **String Functions** | `UPPER`, `LOWER`, `CONCAT`, `LENGTH` | `database/analytics_queries.sql` | Query A1, A2 | Normalizes airline codes, formatted passenger display, email canonicalization |
| **Conditional Logic** | `CASE`, `IF`, `COALESCE` | `database/views.sql`, `database/analytics_queries.sql` | `vw_flight_revenue`, `vw_seat_occupancy`, Query A1 | Multi-tier refund logic, null-safe division for occupancy, gross/refund revenue split |
| **Date & Time Functions** | `DATE_FORMAT`, `DATEDIFF`, `TIMESTAMPDIFF` | `database/analytics_queries.sql`, `database/procedures.sql` | `vw_monthly_revenue`, `sp_process_cancellation` | Grouping revenue by month, calculating hours before departure for refund tiering |
| **Aggregations** | `COUNT`, `SUM`, `AVG`, `MIN`, `MAX` | `database/analytics_queries.sql` | Query C1, D2 | Aggregating gross/net revenue, average fare per class, booking counts |
| **Filtering & Grouping** | `GROUP BY` + `HAVING` | `database/analytics_queries.sql` | Query C1, D1 | Routes with occupancy > 70%, revenue by airline with positive net revenue |
| **Joins** | `INNER JOIN` | `database/views.sql` | `vw_flight_revenue`, `vw_seat_occupancy` | Joining flights, airlines, routes, airports, and seat inventories |
| **Joins** | `LEFT JOIN` | `database/views.sql`, `database/analytics_queries.sql` | Query E1 | Flights with no bookings; outer joins for missing payment/refund data |
| **Joins** | `RIGHT JOIN` | `database/analytics_queries.sql` | Query E2 | Passengers without bookings |
| **Joins** | `SELF JOIN` | `database/analytics_queries.sql` | Query E3 | Identifying round-trip / return route pairs on the `routes` table |
| **Subqueries** | Scalar Subquery | `database/analytics_queries.sql` | Query F1 | Flights with net revenue above overall flight average |
| **Subqueries** | Correlated / `EXISTS` Subquery | `database/analytics_queries.sql` | Query F4 | Flights with at least one cancellation |
| **Subqueries** | Subquery in `HAVING` | `database/analytics_queries.sql` | Query F3 | Passengers with booking counts above passenger average |
| **CTEs** | Multi-Stage CTEs (`WITH`) | `database/views.sql`, `database/analytics_queries.sql` | `vw_flight_revenue`, `vw_seat_occupancy`, Query G1 | Anti-double-counting architecture: pre-aggregates payments and seats before joining flights |
| **Window Functions** | `ROW_NUMBER`, `RANK`, `DENSE_RANK` | `database/analytics_queries.sql` | Query H1, H5 | Ranking flights by revenue; top 5 and bottom 5 revenue flights |
| **Window Functions** | `PARTITION BY` | `database/analytics_queries.sql` | Query H2 | Ranking routes by occupancy partitioned within each airline |
| **Window Functions** | `SUM() OVER (...)` | `database/analytics_queries.sql` | Query H3 | Running cumulative net revenue over chronological months |
| **Window Functions** | Moving Average (`AVG OVER ROWS BETWEEN`) | `database/analytics_queries.sql` | Query H3 | 3-month moving average of net revenue |
| **Window Functions** | `LAG` & `LEAD` | `database/views.sql`, `database/analytics_queries.sql` | `vw_monthly_revenue`, Query H4 | Month-over-month (MoM) revenue growth % and trend classification |
| **Views** | Core Analytics Views | `database/views.sql` | `vw_flight_revenue`, `vw_seat_occupancy`, `vw_route_performance`, `vw_monthly_revenue`, `vw_booking_summary` | Database-level metric encapsulation; zero metric computation in Python/React |
| **Stored Procedures** | DDL / Bulk Operations | `database/procedures.sql` | `sp_create_flight_seats` | Auto-generates flight seat inventory from aircraft physical seat configuration |
| **Stored Procedures** | Parametric Analytical Reports | `database/procedures.sql` | `sp_flight_revenue_report`, `sp_calculate_flight_occupancy` | Multi-class occupancy breakdowns and per-flight revenue audits |
| **Stored Procedures** | Transactional Workflow with Locking | `database/procedures.sql` | `sp_process_booking` | `START TRANSACTION`, `SELECT ... FOR UPDATE`, seat lock, simulated payment, atomic commit/rollback |
| **Stored Procedures** | Cancellation & Tiered Refund | `database/procedures.sql` | `sp_process_cancellation` | Tiered refund policy based on departure lead time; releases inventory atomically |
| **Triggers** | Audit Logging | `database/triggers.sql` | `trg_booking_status_audit`, `trg_payment_audit`, `trg_cancellation_audit` | Captures old and new state into `audit_log` with JSON payloads |
| **Triggers** | State Machine Validation | `database/triggers.sql` | `trg_flight_status_validate` | Enforces valid status transitions: `SCHEDULED` → `BOARDING` → `COMPLETED` / `CANCELLED` |
| **JSON Support** | `->>`, `JSON_EXTRACT`, `JSON_CONTAINS`, `JSON_OBJECT` | `database/analytics_queries.sql`, `database/triggers.sql` | Query M1, M2, M4, triggers | Queries flexible booking metadata (`booking_channel`, `meal_preference`, `baggage_kg`) |
| **Scheduled Events** | MySQL `EVENT` | `database/schema.sql` | `evt_release_expired_holds` | Background event scheduler running every 1 min to release unconfirmed seat holds (>15 min) |
| **Index Optimization** | Composite & Covering Indexes + `EXPLAIN` | `database/indexes.sql`, `database/explain_comparisons.sql` | Comparisons 1, 2, 3 | Index range scans, eliminating filesort and temporary tables on heavy aggregates |

---

## Anti-Double-Counting Architecture (Critical Faculty Viva Talking Point)

### The Problem
When naive joins are performed across:
`flights` ⟕ `bookings` ⟕ `booking_seats` ⟕ `payments`

Each booking with 3 seats multiplies the payment row by 3. If a booking has both an initial `PAYMENT` and a subsequent `REFUND`, the cartesian product causes payments and refunds to be over-counted by `num_seats` times.

### The Solution in AIR-FLOW
In `vw_flight_revenue`, `vw_route_performance`, and `procedures.sql`:
1. Payments are pre-aggregated in a dedicated CTE (`payment_summary`) grouped by `booking_id` alone.
2. Seat assignments are aggregated in a separate CTE (`seat_counts` / `confirmed_seats`) grouped by `flight_id`.
3. The flight layer performs a single `LEFT JOIN` on the pre-aggregated results.
4. **Verification**: Direct sum of raw `payments` table equals `vw_flight_revenue` sum equals `vw_monthly_revenue` sum to the exact paisa (INR 38,053,523.30 net revenue).
