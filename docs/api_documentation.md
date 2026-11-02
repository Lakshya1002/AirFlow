# AIR-FLOW: REST API Documentation

Base URL: `http://localhost:8000/api`  
Interactive Swagger Docs: `http://localhost:8000/docs`  
Authentication: HTTP Bearer JWT Header (`Authorization: Bearer <TOKEN>`)

---

## 1. Authentication Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/auth/login` | Public | Authenticates username/password; returns JWT access token & role |
| `GET` | `/auth/me` | Authenticated | Returns current profile and role (`ADMIN` or `ANALYST`) |
| `POST` | `/auth/register` | ADMIN Only | Registers a new user account |

---

## 2. Analytics & BI Endpoints (Direct SQL Views)

| Method | Endpoint | Query Target | Description |
|---|---|---|---|
| `GET` | `/analytics/dashboard` | Subqueries & Views | Returns KPIs (Net Revenue, Occupancy, Bookings, Flights), monthly trend, airline bar, route bar, pie distribution |
| `GET` | `/analytics/revenue` | `vw_monthly_revenue` | Monthly revenue with `LAG()` MoM growth %, cumulative running total with `SUM() OVER`, top/bottom flights |
| `GET` | `/analytics/occupancy` | `vw_seat_occupancy` | Load factor %, sellable seats (capacity − blocked), high/low bands, occupancy by carrier |
| `GET` | `/analytics/routes` | `vw_route_performance` | Route corridor yield, dense rankings, return route pairs via `SELF JOIN` |
| `GET` | `/analytics/cancellations` | `cancellations` + CTE | Cancellation reasons, lead time before departure, total refunds issued |
| `POST` | `/analytics/fare-scenario` | Dynamic Simulation | Rule-based elasticity simulation based on user-entered elasticity parameter |

---

## 3. Operations & Core Domain Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/flights` | Lists flights with pagination, airline, route, and status filters |
| `POST` | `/flights` | Creates flight and auto-initializes seat inventory via `sp_create_flight_seats` |
| `PATCH` | `/flights/{id}/status` | Updates flight status (guarded by MySQL trigger `trg_flight_status_validate`) |
| `GET` | `/flights/{id}/available-seats` | Lists unreserved, unblocked seats available for booking |
| `GET` | `/bookings` | Lists bookings with search, passenger, flight, status filters |
| `POST` | `/bookings` | Transactional reservation with row locking via `sp_process_booking` |
| `POST` | `/bookings/{id}/cancel` | Releases seats and calculates tiered refund via `sp_process_cancellation` |
| `GET` | `/payments` | Lists payments, filtered by `payment_type` (PAYMENT/REFUND) and `payment_status` |
| `GET` | `/fares` | Lists fare schedules per flight and cabin class |
| `POST` | `/fares` | Adds new class fare with database check against overlapping validity ranges |
| `GET` | `/passengers` | Directory search and listing |
| `POST` | `/passengers` | Registers new traveler |

---

## 4. Reports (CSV Streaming Exports)

| Method | Endpoint | Source View | File Generated |
|---|---|---|---|
| `GET` | `/reports/monthly-revenue` | `vw_monthly_revenue` | `monthly_revenue_report.csv` |
| `GET` | `/reports/flight-performance` | `vw_flight_revenue` | `flight_performance_report.csv` |
| `GET` | `/reports/route-performance` | `vw_route_performance` | `route_performance_report.csv` |
| `GET` | `/reports/seat-utilization` | `vw_seat_occupancy` | `seat_utilization_report.csv` |
| `GET` | `/reports/cancellations` | `cancellations` | `cancellations_report.csv` |
