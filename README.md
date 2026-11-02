# AIR-FLOW

**Advanced SQL-Based Airline Revenue and Seat Utilization Intelligence System**

> Course: 21CSE742P — Advanced SQL and Modern Database Features  
> Student: Lakshya, Final-Year B.Tech CSE

---

## Overview

AIR-FLOW is a database-driven analytics platform that transforms airline operational data (flights, seat inventory, bookings, payments, refunds, fares, cancellations) into actionable revenue and seat-utilization insights.

**The central contribution is Advanced SQL.** The web application is a thin interface over SQL logic — all core analytics are computed inside the database using views, CTEs, window functions, stored procedures, and triggers. Python and React only call and display results.

### Problem Statement

Airline operational data is spread across many tables. Naive joins double-count payments and refunds, and counting blocked seats as capacity distorts occupancy metrics. AIR-FLOW solves this with a carefully designed schema and SQL analytics that compute these metrics correctly inside the database.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Database | MySQL 8.0+ (MySQL Workbench for inspection) |
| Backend | Python 3.10+, FastAPI, SQLAlchemy, PyMySQL, Pydantic, python-jose (JWT), passlib/bcrypt |
| Frontend | React + Vite, JavaScript, React Router, Axios, Recharts, Lucide React, Tailwind CSS |
| Tools | VS Code, Git, Postman |

---

## Database Design

**14 core tables** (+ `audit_log` supporting table if triggers require it):

1. `airlines` — Airline companies
2. `airports` — Airport locations
3. `aircraft` — Fleet (linked to airlines)
4. `aircraft_seats` — Permanent seat layout per aircraft
5. `routes` — Origin-destination pairs with distance
6. `flights` — Scheduled flights with status tracking
7. `flight_seats` — Per-flight seat inventory (initialized from aircraft layout)
8. `passengers` — Passenger directory
9. `bookings` — Booking records with status workflow
10. `booking_seats` — Seat assignments per booking (HELD → CONFIRMED or CANCELLED)
11. `payments` — Payment and refund transactions
12. `fares` — Fare schedules by flight, class, and validity period
13. `cancellations` — Cancellation records with refund amounts
14. `users` — Authentication (ADMIN and ANALYST roles)

### Key Metrics (computed in SQL, never in application code)

- **Gross Revenue** = SUM(payments WHERE type=PAYMENT AND status=SUCCESS)
- **Refunds** = SUM(payments WHERE type=REFUND AND status=SUCCESS)
- **Net Revenue** = Gross Revenue − Refunds
- **Seat Occupancy %** = Confirmed seats / (Total flight seats − Blocked seats) × 100
- **Cancellation Rate** = Cancelled bookings / Total bookings × 100

---

## Project Structure

```
AIR-FLOW/
├── frontend/               # React + Vite application
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── context/
│   │   └── utils/
│   ├── package.json
│   └── .env.example
├── backend/                # FastAPI application
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── analytics/
│   │   ├── database/
│   │   └── utils/
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
├── database/               # All SQL files
│   ├── schema.sql
│   ├── indexes.sql
│   ├── views.sql
│   ├── procedures.sql
│   ├── triggers.sql
│   ├── analytics_queries.sql
│   └── explain_comparisons.sql
├── scripts/                # Data generation and initialization
│   ├── generate_dataset.py
│   └── initialize_database.py
├── docs/                   # Documentation
│   ├── architecture.md
│   ├── database_design.md
│   ├── api_documentation.md
│   ├── testing.md
│   └── sql_concepts_map.md
├── README.md
└── .gitignore
```

---

## Setup Instructions

### Prerequisites

- MySQL 8.0+ (running)
- Python 3.10+
- Node.js 18+
- Git

### 1. Clone and configure

```bash
git clone <repository-url>
cd AIR-FLOW
```

### 2. Database setup

```bash
# Copy and edit the backend .env with your MySQL credentials
cp backend/.env.example backend/.env
# Edit backend/.env with your MySQL root password

# Initialize the database (creates air_flow_db, runs schema, loads data)
cd scripts
python initialize_database.py
```

### 3. Backend setup

```bash
cd backend
pip install -r requirements.txt
python main.py
# API runs at http://localhost:8000
```

### 4. Frontend setup

```bash
cd frontend
npm install
npm run dev
# App runs at http://localhost:5173
```

---

## Demo Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Analyst | `analyst` | `analyst123` |

> Passwords are stored as bcrypt hashes in the `users` table. These are demo credentials only.

---

## Advanced SQL Concepts Demonstrated

| Concept | Where to Find |
|---------|--------------|
| CTEs | `analytics_queries.sql`, `views.sql` |
| Window Functions | `analytics_queries.sql` (ROW_NUMBER, RANK, LAG, running SUM) |
| Views | `views.sql` (5 analytics views) |
| Stored Procedures | `procedures.sql` (seat inventory, reports, cancellation) |
| Triggers | `triggers.sql` (seat consistency, audit log) |
| JSON Functions | `analytics_queries.sql` (booking_metadata analysis) |
| Subqueries | `analytics_queries.sql` |
| Self Joins | `analytics_queries.sql` (reverse route pairs) |
| EXPLAIN Analysis | `explain_comparisons.sql` (before/after index comparison) |
| Transactions + Locking | `procedures.sql` (SELECT ... FOR UPDATE) |

See [`docs/sql_concepts_map.md`](docs/sql_concepts_map.md) for a complete mapping of every SQL concept to its location.

---

## Known Limitations

- Payment processing is simulated (demo mode) — no real payment gateway.
- Fare scenario analysis uses rule-based simulation with user-entered assumptions, not ML prediction.
- No real-time airline API integration.
- Held seats expire after 15 minutes via MySQL EVENT (requires `event_scheduler=ON`).

---

## License

Academic project — not for commercial use.

