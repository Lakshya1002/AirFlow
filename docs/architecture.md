# AIR-FLOW: System Architecture

```
                       ┌──────────────────────────────────────────────┐
                       │          React + Vite + Tailwind UI         │
                       │    (Dashboard, Analytics, "SQL Behind")      │
                       └──────────────────────┬───────────────────────┘
                                              │ REST (Axios + JWT)
                                              ▼
                       ┌──────────────────────────────────────────────┐
                       │             FastAPI Backend Layer            │
                       │     (Routing, Pydantic, Auth, CSV Streams)   │
                       └──────────────────────┬───────────────────────┘
                                              │ SQLAlchemy Core / Session
                                              ▼
 ╔═════════════════════════════════════════════════════════════════════════════╗
 ║                         MySQL 8.0+ Database Engine                          ║
 ║                                                                             ║
 ║  ┌───────────────────────────────────────────────────────────────────────┐  ║
 ║  │                   Advanced SQL Analytical Views                       │  ║
 ║  │   • vw_flight_revenue         (Anti-Double-Counting CTEs)             │  ║
 ║  │   • vw_seat_occupancy         (Load Factor / Blocked Seat Logic)      │  ║
 ║  │   • vw_route_performance      (Dense Rank, Yield, Corridors)          │  ║
 ║  │   • vw_monthly_revenue        (LAG() MoM Growth & Running SUM)        │  ║
 ║  │   • vw_booking_summary        (Passenger, Flight, Payment Aggregates) │  ║
 ║  └───────────────────────────────────┬───────────────────────────────────┘  ║
 ║                                      │                                      ║
 ║  ┌───────────────────────────────────┴───────────────────────────────────┐  ║
 ║  │                     Stored Procedures & Triggers                      │  ║
 ║  │   • sp_process_booking        (SELECT FOR UPDATE, Row-Level Locking)  │  ║
 ║  │   • sp_process_cancellation   (Tiered Lead-Time Refund Policy)        │  ║
 ║  │   • sp_create_flight_seats    (Auto Seat Inventory Factory)           │  ║
 ║  │   • trg_flight_status_validate(State Transition Enforcer)             │  ║
 ║  │   • evt_release_expired_holds (MySQL Background Hold Reaper Event)    │  ║
 ║  └───────────────────────────────────┬───────────────────────────────────┘  ║
 ║                                      │                                      ║
 ║  ┌───────────────────────────────────┴───────────────────────────────────┐  ║
 ║  │               14 Core Relational Tables + Audit Log                   │  ║
 ║  │   • airlines, airports, aircraft, aircraft_seats, routes, flights     │  ║
 ║  │   • flight_seats, passengers, bookings, booking_seats, payments       │  ║
 ║  │   • fares, cancellations, users, audit_log                            │  ║
 ║  └───────────────────────────────────────────────────────────────────────┘  ║
 ╚═════════════════════════════════════════════════════════════════════════════╝
```

---

## Architectural Principles

1. **Database as Computation Core**:
   No metric calculations (occupancy, net revenue, cancellation rate, MoM growth) are written in Python or React. The database views encapsulate all arithmetic, windowing, and conditional classification.

2. **Strict Concurrency & Anti-Double-Booking**:
   - `sp_process_booking` opens an explicit transaction and executes `SELECT flight_seat_id FROM flight_seats WHERE flight_seat_id IN (...) FOR UPDATE`.
   - The table `booking_seats` enforces a partial unique constraint on stored generated column `active_seat_lock`. Cancelled seat rows evaluate to NULL, allowing complete historical audit without blocking future re-assignment.

3. **Anti-Double-Counting Data Pipeline**:
   Joining `payments` directly with multi-seat `booking_seats` multiplies monetary aggregates by the number of seats. AIR-FLOW's views pre-aggregate payments in isolated CTEs by `booking_id` before joining flight or route tables.

