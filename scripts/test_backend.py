import os
import sys
import json
import requests
from decimal import Decimal

BASE_URL = "http://127.0.0.1:8000/api"

def run_tests():
    print("=" * 60)
    print("  AIR-FLOW Backend API Integration Test Suite")
    print("=" * 60)

    # 1. Login Admin
    print("\n[1] Testing Admin Login...")
    res = requests.post(f"{BASE_URL}/auth/login", json={"username": "admin", "password": "admin123"})
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    admin_token = res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print(f"  SUCCESS. Admin token received (role: {res.json()['role']})")

    # 2. Login Analyst
    print("\n[2] Testing Analyst Login...")
    res = requests.post(f"{BASE_URL}/auth/login", json={"username": "analyst", "password": "analyst123"})
    assert res.status_code == 200, f"Analyst login failed: {res.text}"
    analyst_token = res.json()["access_token"]
    analyst_headers = {"Authorization": f"Bearer {analyst_token}"}
    print(f"  SUCCESS. Analyst token received (role: {res.json()['role']})")

    # 3. Test Auth Me
    print("\n[3] Testing /auth/me...")
    res = requests.get(f"{BASE_URL}/auth/me", headers=analyst_headers)
    assert res.status_code == 200, f"/auth/me failed: {res.text}"
    print(f"  SUCCESS. User: {res.json()['username']} (role: {res.json()['role']})")

    # 4. Test CRUD listing
    print("\n[4] Testing Core Entity Listings...")
    for endpoint in ["airlines", "airports", "aircraft", "routes", "flights", "passengers", "payments", "cancellations"]:
        res = requests.get(f"{BASE_URL}/{endpoint}?limit=5", headers=analyst_headers)
        assert res.status_code == 200, f"Failed listing {endpoint}: {res.text}"
        data = res.json()
        print(f"  - /{endpoint}: {len(data)} items returned (sample: {list(data[0].keys()) if data else 'empty'})")

    # 5. Test Analytics Endpoints (Calling SQL Views)
    print("\n[5] Testing Analytics Endpoints (All calling SQL directly)...")
    
    # 5a. Dashboard
    res = requests.get(f"{BASE_URL}/analytics/dashboard", headers=analyst_headers)
    assert res.status_code == 200, f"Dashboard analytics failed: {res.text}"
    dash = res.json()
    print(f"  - Dashboard KPIs: Net Revenue INR {dash['kpis']['total_net_revenue']:,}, Bookings: {dash['kpis']['total_bookings']}, Occupancy: {dash['kpis']['avg_occupancy_pct']}%")
    assert "sql" in dash, "Missing SQL documentation in response"
    print(f"    (Verified SQL behind this KPI: {dash['sql']['kpis'][:40]}...)")

    # 5b. Revenue
    res = requests.get(f"{BASE_URL}/analytics/revenue", headers=analyst_headers)
    assert res.status_code == 200, f"Revenue analytics failed: {res.text}"
    rev = res.json()
    print(f"  - Revenue Months: {len(rev['monthly'])}, Running totals: {len(rev['running_totals'])}, Ranked flights: {len(rev['ranked_flights'])}")

    # 5c. Occupancy
    res = requests.get(f"{BASE_URL}/analytics/occupancy", headers=analyst_headers)
    assert res.status_code == 200, f"Occupancy analytics failed: {res.text}"
    occ = res.json()
    print(f"  - Occupancy Avg: {occ['summary']['avg_occupancy']}%, Distribution bands: {len(occ['distribution'])}, Top flights: {len(occ['top_flights'])}")

    # 5d. Routes
    res = requests.get(f"{BASE_URL}/analytics/routes", headers=analyst_headers)
    assert res.status_code == 200, f"Route analytics failed: {res.text}"
    rts = res.json()
    print(f"  - Routes evaluated: {len(rts['routes'])}, Round trips identified: {len(rts['round_trips'])}")

    # 5e. Cancellations
    res = requests.get(f"{BASE_URL}/analytics/cancellations", headers=analyst_headers)
    assert res.status_code == 200, f"Cancellation analytics failed: {res.text}"
    canc = res.json()
    print(f"  - Total cancellations: {canc['summary']['total_cancellations']}, Rate: {canc['summary']['overall_cancellation_rate']}%")

    # 5f. Fare scenario
    res = requests.post(f"{BASE_URL}/analytics/fare-scenario", json={
        "flight_id": 211,
        "fare_class": "ECONOMY",
        "proposed_fare": 6500.00,
        "demand_elasticity": -1.2
    }, headers=analyst_headers)
    assert res.status_code == 200, f"Fare scenario failed: {res.text}"
    scen = res.json()
    print(f"  - Fare Scenario Simulation: Original INR {scen['original_fare']} -> Proposed INR {scen['proposed_fare']}, Est Revenue Diff: INR {scen['revenue_difference']}")

    # 6. Test Reports (CSV Downloads)
    print("\n[6] Testing CSV Report Downloads...")
    for report_name in ["monthly-revenue", "flight-performance", "route-performance", "seat-utilization", "cancellations"]:
        res = requests.get(f"{BASE_URL}/reports/{report_name}", headers=analyst_headers)
        assert res.status_code == 200, f"Report {report_name} failed: {res.text}"
        assert res.headers.get("content-type") == "text/csv; charset=utf-8", f"Unexpected content type: {res.headers.get('content-type')}"
        lines = res.text.strip().split("\n")
        print(f"  - /reports/{report_name}: {len(lines)} CSV rows generated")

    # 7. Test Transactional Booking Flow
    print("\n[7] Testing Transactional Booking & Payment Confirmation...")
    # Find available flight and seat
    res = requests.get(f"{BASE_URL}/flights/211/available-seats", headers=analyst_headers)
    assert res.status_code == 200
    avail_seats = res.json()
    assert len(avail_seats) >= 2, "Need at least 2 available seats for test"
    seat_1 = avail_seats[0]["flight_seat_id"]
    seat_2 = avail_seats[1]["flight_seat_id"]

    # 7a. Make booking for seat_1
    book_res = requests.post(f"{BASE_URL}/bookings", json={
        "passenger_id": 1,
        "flight_id": 211,
        "seat_ids": [seat_1],
        "payment_method": "UPI",
        "simulate_fail": False,
        "metadata": {"booking_channel": "TEST_SUITE"}
    }, headers=analyst_headers)
    assert book_res.status_code == 200, f"Booking creation failed: {book_res.text}"
    booking_data = book_res.json()
    print(f"  - Booking Created: Ref {booking_data['booking_reference']}, Amount INR {booking_data['total_amount']}, Status: {booking_data['booking_status']}")
    assert booking_data["booking_status"] == "CONFIRMED"

    # 7b. Attempt to book the SAME seat (Edge Case 1: Concurrency / Duplicate active seat)
    print("\n[8] Testing Edge Case: Duplicate Booking for Same Seat...")
    dup_res = requests.post(f"{BASE_URL}/bookings", json={
        "passenger_id": 2,
        "flight_id": 211,
        "seat_ids": [seat_1],
        "payment_method": "CREDIT_CARD",
        "simulate_fail": False
    }, headers=analyst_headers)
    assert dup_res.status_code == 400, f"Expected duplicate seat rejection, got: {dup_res.status_code}"
    print(f"  SUCCESS: Duplicate seat was cleanly rejected: {dup_res.json()['detail']}")

    # 7c. Cancel the booking
    print("\n[9] Testing Cancellation and Refund Flow...")
    bid = booking_data["booking_id"]
    cancel_res = requests.post(f"{BASE_URL}/bookings/{bid}/cancel", json={
        "reason": "Integration Test Cancellation"
    }, headers=analyst_headers)
    assert cancel_res.status_code == 200, f"Cancellation failed: {cancel_res.text}"
    c_data = cancel_res.json()
    print(f"  - Booking Cancelled: ID {c_data['booking_id']}, Refund INR {c_data['refund_amount']}")

    print("\n" + "=" * 60)
    print("  ALL BACKEND INTEGRATION TESTS PASSED (100% REAL MYSQL)")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
