# AIR-FLOW: Advanced SQL-Based Airline Revenue and Seat Utilization Intelligence System

**Course**: 21CSE742P, Advanced SQL and Modern Database Features  
**Author**: Lakshya (Final-Year B.Tech CSE)  
**Academic Viva & Demo Project**

---

## 1. Executive Summary

AIR-FLOW is a database-driven business intelligence and operational analytics platform designed to solve multi-table operational data challenges in the airline industry. Naive SQL joins often double-count payments and refunds when joined with multi-seat reservations, and counting blocked seats as active capacity distorts flight occupancy. 

AIR-FLOW resolves these challenges through an advanced SQL database engine featuring pre-aggregated CTEs, window functions (`LAG`, `ROW_NUMBER`, `RANK`, running `SUM OVER`), stored procedures with row-level locking (`SELECT ... FOR UPDATE`), state-machine triggers, and stored generated columns enforcing partial uniqueness. The FastAPI backend and React frontend serve as a thin, performant presentation layer over the database logic.

---

## 2. Fixed Tech Stack

- **Database**: MySQL 8.0+ Community Server (InnoDB Storage Engine, `utf8mb4_unicode_ci`)
- **Backend**: Python 3.10+, FastAPI, SQLAlchemy, PyMySQL, Pydantic, python-jose (JWT), bcrypt
- **Frontend**: React 18, Vite, Tailwind CSS, Recharts, Lucide React, Axios, React Router v6
- **Architecture**: Decoupled Client-Server over MySQL Stored Routines & Views

---

## 3. Demo Credentials

| Role | Username | Password | Capabilities |
|---|---|---|---|
| **ADMIN** | `admin` | `admin123` | Full access: schedule flights, update statuses, manage fares, create bookings, view all BI analytics |
| **ANALYST** | `analyst` | `analyst123` | Read-only BI intelligence: view dashboards, inspect SQL logic, run fare simulations, export CSV reports |

*(Passwords are stored as 12-round bcrypt hashes in the `users` table).*

---

## 4. Key Advanced SQL Features & Viva Talking Points

1. **Anti-Double-Counting Architecture**:
   - In `vw_flight_revenue` and `procedures.sql`, payments and refunds are pre-aggregated in dedicated CTEs by `booking_id` *before* joining to flights.
   - **Financial Reconciliation Proof**: Raw table sum of `payments` (₹3,80,53,523.30 net) equals `vw_flight_revenue` sum equals `vw_monthly_revenue` sum to the exact paisa (0.00 discrepancy).
2. **Double-Booking Prevention with Partial Uniqueness**:
   - `booking_seats` has a stored generated column `active_seat_lock` that equals `flight_seat_id` if status is `HELD` or `CONFIRMED`, else `NULL`.
   - Combined with `UNIQUE (flight_seat_id, active_seat_lock)`, multiple `CANCELLED` records are preserved as audit history while conflicting active bookings are immediately rejected (`ERROR 1062`).
3. **Transactional Concurrency with Row Locking**:
   - `sp_process_booking` executes `SELECT ... FOR UPDATE` on `flight_seats` to lock requested seats across simultaneous competing threads.
4. **Window Functions**:
   - Month-Over-Month revenue growth using `LAG(net_revenue) OVER (ORDER BY revenue_month)` in `vw_monthly_revenue`.
   - Running cumulative revenue using `SUM(net_revenue) OVER (ORDER BY revenue_month)`.
   - Moving average using `AVG(net_revenue) OVER (... ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)`.
   - Top 5 and Bottom 5 revenue flights using `ROW_NUMBER() OVER (...)`.
5. **JSON Functions**:
   - Booking channel, baggage tiers, and meal preferences extracted from `booking_metadata` using `->>`, `JSON_EXTRACT`, and `JSON_CONTAINS`.
6. **Self-Joins**:
   - Bidirectional route corridor pairs identified via `routes r1 INNER JOIN routes r2 ON r1.origin = r2.destination AND r1.destination = r2.origin`.
7. **"SQL Behind This" Interface**:
   - Every chart, table, and KPI on the frontend features a dedicated "SQL Behind This" button that displays the exact query and view powering the visualization.

---

## 5. Quick Setup & Run Instructions

### Prerequisites
- MySQL 8.0+ running on `localhost:3306`
- Python 3.10+
- Node.js 18+ and npm

### 1. Database Initialization
```bash
# Verify credentials in backend/.env (DB_PASSWORD=...)
cd scripts
python initialize_database.py
```
*This drops `air_flow_db`, builds 14 tables + audit log, compiles views/triggers/procedures, seeds 85,000+ flight inventory seats, and verifies financial reconciliation.*

### 2. Launch FastAPI Backend
```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
# API Documentation available at http://127.0.0.1:8000/docs
```

### 3. Launch React Frontend
```bash
cd frontend
npm install
npm run dev
# Web application live at http://localhost:5173
```

---

## 6. Automated Test Suites

```bash
# 1. Run Core Backend API & View Integration Tests
python scripts/test_backend.py

# 2. Run Section 13 Mandatory Edge Cases & Thread Concurrency Test
python scripts/test_edge_cases.py
```

---

## 7. Documentation Index

- [`docs/sql_concepts_map.md`](docs/sql_concepts_map.md): Syllabus-to-query map for faculty viva.
- [`docs/database_design.md`](docs/database_design.md): 14-table schema data dictionary and relationships.
- [`docs/testing.md`](docs/testing.md): Edge cases and empirical test logs.
- [`docs/architecture.md`](docs/architecture.md): Architectural diagram and data pipeline.
- [`docs/api_documentation.md`](docs/api_documentation.md): REST endpoints specification.
- [`database/explain_comparisons.sql`](database/explain_comparisons.sql): Before/after index optimization with written interpretation.
