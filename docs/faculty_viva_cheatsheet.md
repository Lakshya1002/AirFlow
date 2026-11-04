# AIR-FLOW: Faculty Viva & Live Demo Walkthrough Guide

Course: **21CSE742P &bull; Advanced SQL and Modern Database Features**  
Student: **Lakshya (Final-Year B.Tech CSE)**  
Platform: **AIR-FLOW Intelligence System**

This guide provides the exact queries, terminal commands, UI interactions, and academic defenses prepared specifically for your faculty viva and project demonstration.

---

## 🎯 Viva Evidence Checklist (Section 14 Deliverables)

### 1. Concurrency Test Demonstration (Race Condition Protection)

**Question Faculty May Ask**: *"What happens when two users book the last available seat simultaneously?"*

**Demonstration**:
Run the automated multi-threaded concurrency test:
```bash
python scripts/test_edge_cases.py
```

**Walkthrough Explanation to Give**:
> *"In our stored procedure `sp_process_booking`, we use pessimistic row-level locking via `SELECT flight_seat_id FROM flight_seats WHERE ... FOR UPDATE`. In addition, table `booking_seats` utilizes a stored generated column `active_seat_lock` combined with a `UNIQUE (flight_seat_id, active_seat_lock)` constraint. When two concurrent threads issue a reservation for the exact same seat, MySQL puts the second transaction in a lock wait. As soon as the first thread commits, the second thread reads the updated status (`BOOKED`), aborts with `ERROR 1644: One or more seats are not available for booking`, and triggers an atomic `ROLLBACK`. Exactly one booking succeeds."*

---

### 2. Financial Reconciliation Proof (Anti-Double-Counting Architecture)

**Question Faculty May Ask**: *"How do you prove your revenue analytics aren't double-counting payments due to multi-seat joins?"*

**Demonstration**:
Open MySQL Workbench (or CLI) and execute this query:
```sql
USE air_flow_db;

SELECT 
    'Raw Payments Table' AS calculation_source,
    SUM(CASE WHEN payment_type = 'PAYMENT' AND payment_status = 'SUCCESS' THEN amount ELSE 0 END) AS gross_revenue,
    SUM(CASE WHEN payment_type = 'REFUND'  AND payment_status = 'SUCCESS' THEN amount ELSE 0 END) AS total_refunds,
    SUM(CASE WHEN payment_type = 'PAYMENT' AND payment_status = 'SUCCESS' THEN amount ELSE 0 END)
    - SUM(CASE WHEN payment_type = 'REFUND' AND payment_status = 'SUCCESS' THEN amount ELSE 0 END) AS net_revenue
FROM payments
UNION ALL
SELECT 
    'vw_flight_revenue (Flight View)',
    SUM(gross_revenue),
    SUM(total_refunds),
    SUM(net_revenue)
FROM vw_flight_revenue
UNION ALL
SELECT 
    'vw_monthly_revenue (Monthly View)',
    SUM(gross_revenue),
    SUM(total_refunds),
    SUM(net_revenue)
FROM vw_monthly_revenue;
```

**Expected Result**:
- All three sources report **Gross: ₹4,20,55,053.00**, **Refunds: ₹40,01,529.70**, and **Net: ₹3,80,53,523.30**.
- **Variance: ₹0.00**.

**Walkthrough Explanation**:
> *"When a booking has 3 seats, joining `bookings` directly to `booking_seats` and `payments` multiplies the payment row by 3. In AIR-FLOW, we prevent this by pre-aggregating payments into a dedicated Common Table Expression (CTE) grouped by `booking_id` alone. Flights then join this single pre-aggregated row. Notice that our UI dashboard displays this exact net revenue, matching raw ledger tables to the paisa."*

---

### 3. EXPLAIN Before/After Index Optimization

**Question Faculty May Ask**: *"Demonstrate query optimization using EXPLAIN and composite indexes."*

**Demonstration** (from `database/explain_comparisons.sql`):
In MySQL Workbench, compare index scan vs full table scan:
```sql
USE air_flow_db;

-- Filtered query on payments
EXPLAIN
SELECT SUM(amount) AS gross_revenue
FROM payments
WHERE payment_type = 'PAYMENT' AND payment_status = 'SUCCESS';
```

**Walkthrough Explanation**:
> *"Without our composite index on `(payment_type, payment_status)`, MySQL must execute an `ALL` full table scan across all 4,400+ payment rows. With index `idx_payments_type_status`, MySQL performs a targeted `ref` scan using constant key lookups (`const, const`), reading only matching successful payments and bypassing failed attempts and refund rows. We also created composite index `idx_flights_departure_status (departure_time, flight_status)` to convert chronological dashboard range scans into bounded index range scans (`type: range`)."*

---

### 4. Code Walkthrough for Every Major Advanced SQL Feature

Have these files open in VS Code to show faculty:

| Feature | File & Object | What to Show the Faculty |
|---|---|---|
| **CTE (Common Table Expression)** | [`database/views.sql`](file:///c:/Users/laksh/Downloads/airline/AIR-FLOW/database/views.sql) (`vw_flight_revenue`) | Show the multi-stage `WITH payment_summary AS (...)`, `booking_revenue AS (...)` pipeline isolating payment aggregation before the outer join. |
| **Window Functions (`LAG`, `LEAD`)** | [`database/views.sql`](file:///c:/Users/laksh/Downloads/airline/AIR-FLOW/database/views.sql) (`vw_monthly_revenue`) | Point to `LAG(gross_revenue - total_refunds) OVER (ORDER BY revenue_month)` computing month-over-month growth percentage in SQL. |
| **Window Functions (`ROW_NUMBER`, `RANK`)** | [`database/analytics_queries.sql`](file:///c:/Users/laksh/Downloads/airline/AIR-FLOW/database/analytics_queries.sql) (Query H5) | Point to `ROW_NUMBER() OVER (ORDER BY net_revenue DESC)` used to extract Top 5 and Bottom 5 revenue flights simultaneously. |
| **Window Functions (Running Total)** | [`database/analytics_queries.sql`](file:///c:/Users/laksh/Downloads/airline/AIR-FLOW/database/analytics_queries.sql) (Query H3) | Point to `SUM(net_revenue) OVER (ORDER BY revenue_month)` producing cumulative financial progression. |
| **Stored Procedure + Transactions** | [`database/procedures.sql`](file:///c:/Users/laksh/Downloads/airline/AIR-FLOW/database/procedures.sql) (`sp_process_booking`) | Show `START TRANSACTION`, `SELECT ... FOR UPDATE`, conditional `SIGNAL SQLSTATE '45000'`, and atomic `COMMIT`. |
| **Database Triggers** | [`database/triggers.sql`](file:///c:/Users/laksh/Downloads/airline/AIR-FLOW/database/triggers.sql) (`trg_flight_status_validate`) | Show state machine enforcement: prevents invalid transitions (e.g., `SCHEDULED` cannot skip straight to `COMPLETED`), raising SQLSTATE 45000. |
| **JSON Functions** | [`database/analytics_queries.sql`](file:///c:/Users/laksh/Downloads/airline/AIR-FLOW/database/analytics_queries.sql) (Query M1, M2) | Show extraction of flexible metadata via `booking_metadata ->> '$.booking_channel'` and `JSON_CONTAINS(b.booking_metadata, '"VEG"', '$.meal_preference')`. |
| **Self-Join** | [`database/analytics_queries.sql`](file:///c:/Users/laksh/Downloads/airline/AIR-FLOW/database/analytics_queries.sql) (Query E3) | Show `routes r1 INNER JOIN routes r2 ON r1.origin = r2.destination AND r1.destination = r2.origin` dynamically detecting return route pairs. |
| **Generated Column + Constraint** | [`database/schema.sql`](file:///c:/Users/laksh/Downloads/airline/AIR-FLOW/database/schema.sql) (`booking_seats`) | Show stored column `active_seat_lock` allowing multiple `NULL` cancelled rows while enforcing uniqueness on active assignments. |

---

## 💻 Live Application UI Demonstration Script (5 Minutes)

1. **Login**:
   - Open [http://localhost:5173](http://localhost:5173).
   - Click the **"Analyst Role"** quick login button (demonstrating role-based access).
2. **Dashboard Overview**:
   - Show the 6 KPI cards (Net Revenue, Total Bookings, Active Flights, Seat Occupancy, Passengers, Cancellation Rate).
   - Point out that occupancy is strictly computed as `Confirmed / (Capacity − Blocked)`.
   - Click the dark **"SQL Behind Dashboard"** button in the top right to display the raw SQL queries running inside MySQL.
3. **Revenue Analytics Page**:
   - Navigate to `/analytics/revenue`.
   - Point out the Month-over-Month growth table powered by `LAG()`.
   - Show the cumulative running total line chart powered by `SUM() OVER`.
   - Click **"SQL Behind This"** to prove that no Python or JS math was performed.
4. **Interactive Booking & Seat Map**:
   - Navigate to `/bookings`.
   - Click **"New Reservation"**. Select a flight and show the interactive visual seat grid.
   - Check the box **"Simulate Payment Failure"** &rarr; submit.
   - Show that the booking was marked `CANCELLED`, the payment was recorded as `FAILED` (for audit analytics), and the seat was automatically returned to `AVAILABLE` status.
5. **Fare Sensitivity Scenario Simulation**:
   - Navigate to `/fare-scenario`.
   - Select a flight, change the fare from ₹5,000 to ₹6,500, adjust the elasticity slider, and click **"Calculate Revenue Impact"**.
   - Point out the academic disclaimer clarifying that this is a rule-based microeconomic simulation.
6. **Reports**:
   - Navigate to `/reports` and click **"Download CSV Export"** on any report to show on-the-fly streaming of MySQL view data.

