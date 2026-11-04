from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, Dict, Any, List
from decimal import Decimal
from app.database.session import get_db
from app.schemas.schemas import FareScenarioRequest, FareScenarioResponse
from app.api.deps import require_analyst

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/dashboard")
def get_dashboard_analytics(
    airline_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    # SQL 1: KPIs
    kpi_sql = """
    SELECT
        (SELECT COALESCE(SUM(CASE WHEN payment_type='PAYMENT' AND payment_status='SUCCESS' THEN amount ELSE 0 END)
                       - SUM(CASE WHEN payment_type='REFUND' AND payment_status='SUCCESS' THEN amount ELSE 0 END), 0)
         FROM payments) AS total_net_revenue,
        (SELECT COUNT(*) FROM bookings) AS total_bookings,
        (SELECT COUNT(*) FROM flights) AS total_flights,
        (SELECT ROUND(AVG(occupancy_pct), 2) FROM vw_seat_occupancy) AS avg_occupancy_pct,
        (SELECT COUNT(*) FROM passengers) AS total_passengers,
        (SELECT ROUND(COUNT(CASE WHEN booking_status = 'CANCELLED' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0), 2)
         FROM bookings) AS cancellation_rate
    """
    kpis = dict(db.execute(text(kpi_sql)).mappings().first())

    # SQL 2: Monthly revenue trend (using vw_monthly_revenue with LAG)
    monthly_sql = """
    SELECT 
        revenue_month,
        gross_revenue,
        total_refunds,
        net_revenue,
        mom_growth_pct
    FROM vw_monthly_revenue
    ORDER BY revenue_month ASC
    """
    monthly_trend = [dict(r) for r in db.execute(text(monthly_sql)).mappings().all()]

    # SQL 3: Revenue by airline
    airline_sql = """
    SELECT
        al.airline_name,
        al.airline_code,
        SUM(fr.net_revenue) AS net_revenue,
        SUM(fr.total_bookings) AS total_bookings,
        SUM(fr.confirmed_bookings) AS confirmed_bookings
    FROM vw_flight_revenue fr
    INNER JOIN airlines al ON fr.airline_name = al.airline_name
    GROUP BY al.airline_name, al.airline_code
    ORDER BY net_revenue DESC
    LIMIT 10
    """
    airline_revenue = [dict(r) for r in db.execute(text(airline_sql)).mappings().all()]

    # SQL 4: Revenue by route (Top 10)
    route_sql = """
    SELECT
        CONCAT(origin_code, ' → ', destination_code) AS route_label,
        net_revenue,
        flight_count,
        avg_occupancy_pct
    FROM vw_route_performance
    WHERE net_revenue > 0
    ORDER BY net_revenue DESC
    LIMIT 10
    """
    route_revenue = [dict(r) for r in db.execute(text(route_sql)).mappings().all()]

    # SQL 5: Booking status breakdown
    status_sql = """
    SELECT
        booking_status,
        COUNT(*) AS count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM bookings), 2) AS percentage
    FROM bookings
    GROUP BY booking_status
    """
    booking_status_dist = [dict(r) for r in db.execute(text(status_sql)).mappings().all()]

    # SQL 6: Fare class distribution
    class_sql = """
    SELECT
        acs.seat_class AS fare_class,
        COUNT(DISTINCT bs.booking_seat_id) AS seats_sold,
        SUM(CASE WHEN p.payment_type = 'PAYMENT' AND p.payment_status = 'SUCCESS' THEN p.amount ELSE 0 END) AS gross_revenue
    FROM booking_seats bs
    INNER JOIN flight_seats fs ON bs.flight_seat_id = fs.flight_seat_id
    INNER JOIN aircraft_seats acs ON fs.aircraft_seat_id = acs.aircraft_seat_id
    INNER JOIN bookings b ON bs.booking_id = b.booking_id
    LEFT JOIN payments p ON b.booking_id = p.booking_id
    WHERE bs.seat_status = 'CONFIRMED'
    GROUP BY acs.seat_class
    ORDER BY FIELD(acs.seat_class, 'FIRST', 'BUSINESS', 'ECONOMY')
    """
    fare_class_perf = [dict(r) for r in db.execute(text(class_sql)).mappings().all()]

    return {
        "kpis": kpis,
        "monthly_trend": monthly_trend,
        "airline_revenue": airline_revenue,
        "route_revenue": route_revenue,
        "booking_status_dist": booking_status_dist,
        "fare_class_perf": fare_class_perf,
        "sql": {
            "kpis": kpi_sql.strip(),
            "monthly_trend": monthly_sql.strip(),
            "airline_revenue": airline_sql.strip(),
            "route_revenue": route_sql.strip(),
            "booking_status_dist": status_sql.strip(),
            "fare_class_perf": class_sql.strip()
        }
    }

@router.get("/revenue")
def get_revenue_analytics(
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    # Monthly with LAG window function
    monthly_sql = """
    SELECT 
        revenue_month,
        gross_revenue,
        total_refunds,
        net_revenue,
        prev_month_net,
        mom_growth_pct,
        CASE
            WHEN mom_growth_pct > 0 THEN '📈 Growth'
            WHEN mom_growth_pct < 0 THEN '📉 Decline'
            ELSE '—'
        END AS trend
    FROM vw_monthly_revenue
    ORDER BY revenue_month ASC
    """
    monthly = [dict(r) for r in db.execute(text(monthly_sql)).mappings().all()]

    # Window function: Running total revenue
    running_sql = """
    SELECT
        revenue_month,
        net_revenue,
        SUM(net_revenue) OVER (ORDER BY revenue_month) AS cumulative_revenue,
        ROUND(AVG(net_revenue) OVER (
            ORDER BY revenue_month
            ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
        ), 2) AS moving_avg_3m
    FROM vw_monthly_revenue
    ORDER BY revenue_month ASC
    """
    running_totals = [dict(r) for r in db.execute(text(running_sql)).mappings().all()]

    # Window function: Top 5 and Bottom 5 revenue flights
    ranked_sql = """
    WITH ranked_flights AS (
        SELECT
            flight_number,
            airline_name,
            origin_code,
            destination_code,
            net_revenue,
            ROW_NUMBER() OVER (ORDER BY net_revenue DESC) AS rank_top,
            ROW_NUMBER() OVER (ORDER BY net_revenue ASC)  AS rank_bottom
        FROM vw_flight_revenue
        WHERE net_revenue > 0
    )
    SELECT
        flight_number,
        airline_name,
        CONCAT(origin_code, ' → ', destination_code) AS route,
        net_revenue,
        CASE
            WHEN rank_top <= 5 THEN CONCAT('Top #', rank_top)
            WHEN rank_bottom <= 5 THEN CONCAT('Bottom #', rank_bottom)
        END AS category
    FROM ranked_flights
    WHERE rank_top <= 5 OR rank_bottom <= 5
    ORDER BY net_revenue DESC
    """
    ranked_flights = [dict(r) for r in db.execute(text(ranked_sql)).mappings().all()]

    return {
        "monthly": monthly,
        "running_totals": running_totals,
        "ranked_flights": ranked_flights,
        "sql": {
            "monthly": monthly_sql.strip(),
            "running_totals": running_sql.strip(),
            "ranked_flights": ranked_sql.strip()
        }
    }

@router.get("/occupancy")
def get_occupancy_analytics(
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    # Overall seat occupancy breakdown from view
    summary_sql = """
    SELECT
        ROUND(AVG(occupancy_pct), 2) AS avg_occupancy,
        SUM(total_seats) AS total_capacity,
        SUM(sellable_seats) AS total_sellable,
        SUM(confirmed_occupied) AS total_occupied,
        SUM(blocked_seats) AS total_blocked,
        SUM(available_seats) AS total_available
    FROM vw_seat_occupancy
    """
    summary = dict(db.execute(text(summary_sql)).mappings().first())

    # High occupancy vs low occupancy distribution
    distribution_sql = """
    SELECT
        CASE
            WHEN occupancy_pct >= 85 THEN 'Very High (≥85%)'
            WHEN occupancy_pct >= 70 THEN 'High (70-84%)'
            WHEN occupancy_pct >= 50 THEN 'Moderate (50-69%)'
            ELSE 'Low (<50%)'
        END AS occupancy_band,
        COUNT(*) AS flight_count,
        ROUND(AVG(occupancy_pct), 2) AS band_avg_occupancy
    FROM vw_seat_occupancy
    GROUP BY occupancy_band
    ORDER BY band_avg_occupancy DESC
    """
    distribution = [dict(r) for r in db.execute(text(distribution_sql)).mappings().all()]

    # Occupancy by airline
    airline_occ_sql = """
    SELECT
        al.airline_name,
        ROUND(AVG(so.occupancy_pct), 2) AS avg_occupancy,
        SUM(so.confirmed_occupied) AS occupied_seats,
        SUM(so.sellable_seats) AS sellable_seats
    FROM vw_seat_occupancy so
    INNER JOIN airlines al ON so.airline_name = al.airline_name
    GROUP BY al.airline_name
    ORDER BY avg_occupancy DESC
    """
    airline_occ = [dict(r) for r in db.execute(text(airline_occ_sql)).mappings().all()]

    # Top flights by occupancy
    top_flights_sql = """
    SELECT
        flight_number,
        airline_name,
        CONCAT(origin_code, ' → ', destination_code) AS route,
        sellable_seats,
        confirmed_occupied,
        occupancy_pct
    FROM vw_seat_occupancy
    ORDER BY occupancy_pct DESC
    LIMIT 10
    """
    top_flights = [dict(r) for r in db.execute(text(top_flights_sql)).mappings().all()]

    return {
        "summary": summary,
        "distribution": distribution,
        "airline_occupancy": airline_occ,
        "top_flights": top_flights,
        "sql": {
            "summary": summary_sql.strip(),
            "distribution": distribution_sql.strip(),
            "airline_occupancy": airline_occ_sql.strip(),
            "top_flights": top_flights_sql.strip()
        }
    }

@router.get("/routes")
def get_route_analytics(
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    routes_sql = """
    SELECT
        route_id,
        CONCAT(origin_code, ' → ', destination_code) AS route_label,
        origin_city,
        destination_city,
        distance_km,
        flight_count,
        total_bookings,
        confirmed_bookings,
        cancelled_bookings,
        gross_revenue,
        total_refunds,
        net_revenue,
        avg_fare,
        avg_occupancy_pct,
        cancellation_rate,
        DENSE_RANK() OVER (ORDER BY net_revenue DESC) AS revenue_rank
    FROM vw_route_performance
    ORDER BY net_revenue DESC
    """
    routes = [dict(r) for r in db.execute(text(routes_sql)).mappings().all()]

    # Self-join reverse route pairs
    self_join_sql = """
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
    WHERE r1.route_id < r2.route_id
    ORDER BY r1.distance_km DESC
    LIMIT 10
    """
    round_trips = [dict(r) for r in db.execute(text(self_join_sql)).mappings().all()]

    return {
        "routes": routes,
        "round_trips": round_trips,
        "sql": {
            "routes": routes_sql.strip(),
            "round_trips": self_join_sql.strip()
        }
    }

@router.get("/cancellations")
def get_cancellation_analytics(
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    reasons_sql = """
    SELECT
        COALESCE(c.cancellation_reason, 'Not specified') AS reason,
        COUNT(*) AS cancellation_count,
        SUM(c.refund_amount) AS total_refunded,
        ROUND(AVG(c.refund_amount), 2) AS avg_refund,
        ROUND(AVG(TIMESTAMPDIFF(HOUR, b.booking_date, c.cancellation_date)), 1) AS avg_lead_hours
    FROM cancellations c
    INNER JOIN bookings b ON c.booking_id = b.booking_id
    GROUP BY c.cancellation_reason
    ORDER BY cancellation_count DESC
    """
    reasons = [dict(r) for r in db.execute(text(reasons_sql)).mappings().all()]

    refund_summary_sql = """
    SELECT
        COUNT(*) AS total_cancellations,
        SUM(refund_amount) AS total_refunded,
        ROUND(AVG(refund_amount), 2) AS avg_refund,
        (SELECT ROUND(COUNT(CASE WHEN booking_status = 'CANCELLED' THEN 1 END) * 100.0 / COUNT(*), 2) FROM bookings) AS overall_cancellation_rate
    FROM cancellations
    """
    summary = dict(db.execute(text(refund_summary_sql)).mappings().first())

    return {
        "summary": summary,
        "reasons": reasons,
        "sql": {
            "summary": refund_summary_sql.strip(),
            "reasons": reasons_sql.strip()
        }
    }

@router.post("/fare-scenario", response_model=FareScenarioResponse)
def simulate_fare_scenario(
    scenario: FareScenarioRequest,
    db: Session = Depends(get_db),
    user = Depends(require_analyst)
):
    # Rule-based simulation with user-entered assumptions (NO ML)
    # Fetch existing fare for this flight & class
    fare_sql = text("""
        SELECT base_fare FROM fares
        WHERE flight_id = :fid AND fare_class = :fc
        LIMIT 1
    """)
    current_fare_row = db.execute(fare_sql, {
        "fid": scenario.flight_id,
        "fc": scenario.fare_class.upper()
    }).first()

    original_fare = current_fare_row[0] if current_fare_row else Decimal("5000.00")

    # Fetch current confirmed seats sold for this flight & class
    seats_sql = text("""
        SELECT COUNT(DISTINCT bs.booking_seat_id)
        FROM booking_seats bs
        INNER JOIN flight_seats fs ON bs.flight_seat_id = fs.flight_seat_id
        INNER JOIN aircraft_seats acs ON fs.aircraft_seat_id = acs.aircraft_seat_id
        WHERE fs.flight_id = :fid
          AND acs.seat_class = :fc
          AND bs.seat_status = 'CONFIRMED'
    """)
    current_seats = db.execute(seats_sql, {
        "fid": scenario.flight_id,
        "fc": scenario.fare_class.upper()
    }).scalar() or 0

    # Calculate percentage change in fare
    pct_fare_change = float((scenario.proposed_fare - original_fare) / original_fare)
    # Demand change = elasticity * % fare change
    pct_demand_change = scenario.demand_elasticity * pct_fare_change
    estimated_seats = max(0, int(round(current_seats * (1 + pct_demand_change))))

    original_revenue = original_fare * current_seats
    estimated_revenue = scenario.proposed_fare * estimated_seats
    diff = estimated_revenue - original_revenue

    return {
        "flight_id": scenario.flight_id,
        "fare_class": scenario.fare_class.upper(),
        "original_fare": original_fare,
        "proposed_fare": scenario.proposed_fare,
        "pct_fare_change": round(pct_fare_change * 100, 2),
        "current_seats_sold": current_seats,
        "assumed_elasticity": scenario.demand_elasticity,
        "estimated_seats_demanded": estimated_seats,
        "original_revenue": original_revenue,
        "estimated_revenue": estimated_revenue,
        "revenue_difference": diff,
        "disclaimer": "Rule-based economic elasticity model based on user-entered elasticity parameter. Not an autonomous prediction."
    }

