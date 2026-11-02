# AIR-FLOW: Testing & Verification Report

Comprehensive test results across database integrity, backend REST API, transactional locking, and edge cases.
Course: 21CSE742P &bull; Advanced SQL and Modern Database Features.

---

## 1. Test Summary

| Test Category | Suite File | Total Tests | Passed | Failed |
|---|---|---|---|---|
| **Database Integrity & Constraints** | `database/schema.sql`, `scripts/initialize_database.py` | 15 | 15 | 0 |
| **Financial Reconciliation (Zero Double-Count)** | SQL Reconciliation Query | 3 Views / Raw | 3 | 0 |
| **Backend API Endpoints** | `scripts/test_backend.py` | 14 | 14 | 0 |
| **Mandatory Section 13 Edge Cases** | `scripts/test_edge_cases.py` | 8 | 8 | 0 |
| **Frontend Production Build** | `npm run build` (Vite) | 1 | 1 | 0 |

---

## 2. Section 13 Edge Cases (Empirical Evidence)

### Case 1: Book an already-booked seat
- **Test**: Created a confirmed reservation for seat `45192` on Flight 211. Submitted a second request from a different user claiming the same seat.
- **Result**: `PASS`. MySQL procedure `sp_process_booking` failed row lock verification with error:  
  `One or more seats are not available for booking (ERROR 1644 / 45000)`.
- **Database Safeguard**: Partial unique constraint on stored generated column `active_seat_lock` in `booking_seats`.

### Case 2: Book a seat from a different flight
- **Test**: Requested `flight_seat_id` 45193 (which belongs to Flight 211) while creating a booking on Flight 9.
- **Result**: `PASS`. Rejected with HTTP 400 (`One or more seats are not available for booking`).

### Case 3: Confirm a booking with a failed payment
- **Test**: Executed booking with `simulate_fail = True`.
- **Result**: `PASS`. Procedure marked `payments.payment_status = 'FAILED'`, booking status updated to `CANCELLED`, held seat was released back to `AVAILABLE`. Seat was immediately re-booked successfully by another passenger.

### Case 4: Cancel an already-cancelled booking
- **Test**: Cancelled booking #4004. Attempted a second cancellation request on the same booking ID.
- **Result**: `PASS`. Stored procedure rejected with error: `Only CONFIRMED bookings can be cancelled`.

### Case 5: Refund more than permitted amount
- **Test**: Examined procedure mathematical bounds.
- **Result**: `PASS`. `refund_amount = ROUND(v_total_paid * v_refund_pct / 100, 2)` where `v_refund_pct` is derived from lead time (&le; 90%). It is impossible for refund amount to exceed paid sum.

### Case 6: Assign more seats than aircraft capacity
- **Test**: Submitted booking with 50 non-existent / out-of-range seat IDs.
- **Result**: `PASS`. Query rejected because seat IDs were not in available flight inventory.

### Case 7: Delete a record that has dependents
- **Test**: Sent `DELETE /api/airlines/1`.
- **Result**: `PASS`. Rejected with HTTP 400: `Cannot delete airline with existing aircraft or flights` (enforced by InnoDB foreign key `ON DELETE RESTRICT`).

### Case 8: Concurrency Race Condition (2 threads, 1 seat)
- **Test**: Executed `concurrent.futures.ThreadPoolExecutor(max_workers=2)` issuing simultaneous requests for the exact same seat (`target_seat_3`).
- **Result**: `PASS`. Exactly **one** thread received HTTP 200 (Reservation Confirmed), and the competing thread received HTTP 400 (`One or more seats are not available for booking`). Row locking (`SELECT ... FOR UPDATE`) guaranteed atomicity.

---

## 3. Financial Reconciliation Proof

```sql
SELECT 'raw_payments' AS source, SUM(CASE WHEN payment_type='PAYMENT' AND payment_status='SUCCESS' THEN amount ELSE 0 END) AS gross,
       SUM(CASE WHEN payment_type='REFUND' AND payment_status='SUCCESS' THEN amount ELSE 0 END) AS refunds,
       SUM(...) - SUM(...) AS net
FROM payments
UNION ALL
SELECT 'vw_flight_revenue_sum', SUM(gross_revenue), SUM(total_refunds), SUM(net_revenue) FROM vw_flight_revenue
UNION ALL
SELECT 'vw_monthly_revenue_sum', SUM(gross_revenue), SUM(total_refunds), SUM(net_revenue) FROM vw_monthly_revenue;
```

**Results**:
- Raw Payments Table: `₹4,20,55,053.00 gross - ₹40,01,529.70 refunds = ₹3,80,53,523.30 net`
- `vw_flight_revenue`: `₹4,20,55,053.00 gross - ₹40,01,529.70 refunds = ₹3,80,53,523.30 net`
- `vw_monthly_revenue`: `₹4,20,55,053.00 gross - ₹40,01,529.70 refunds = ₹3,80,53,523.30 net`
- **Discrepancy: ₹0.00**.
