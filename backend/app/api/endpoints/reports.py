import csv
import io
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database.session import get_db
from app.api.deps import require_analyst

router = APIRouter(prefix="/reports", tags=["Reports"])

def generate_csv_response(rows, filename: str):
    if not rows:
        return Response(content="No data available", media_type="text/csv")
    
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    for row in rows:
        writer.writerow(dict(row))
    
    csv_content = output.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/monthly-revenue")
def export_monthly_revenue(db: Session = Depends(get_db), user = Depends(require_analyst)):
    sql = text("SELECT * FROM vw_monthly_revenue ORDER BY revenue_month")
    rows = db.execute(sql).mappings().all()
    return generate_csv_response(rows, "monthly_revenue_report.csv")

@router.get("/flight-performance")
def export_flight_performance(db: Session = Depends(get_db), user = Depends(require_analyst)):
    sql = text("SELECT * FROM vw_flight_revenue ORDER BY net_revenue DESC")
    rows = db.execute(sql).mappings().all()
    return generate_csv_response(rows, "flight_performance_report.csv")

@router.get("/route-performance")
def export_route_performance(db: Session = Depends(get_db), user = Depends(require_analyst)):
    sql = text("SELECT * FROM vw_route_performance ORDER BY net_revenue DESC")
    rows = db.execute(sql).mappings().all()
    return generate_csv_response(rows, "route_performance_report.csv")

@router.get("/seat-utilization")
def export_seat_utilization(db: Session = Depends(get_db), user = Depends(require_analyst)):
    sql = text("SELECT * FROM vw_seat_occupancy ORDER BY occupancy_pct DESC")
    rows = db.execute(sql).mappings().all()
    return generate_csv_response(rows, "seat_utilization_report.csv")

@router.get("/cancellations")
def export_cancellations(db: Session = Depends(get_db), user = Depends(require_analyst)):
    sql = text("""
        SELECT 
            c.cancellation_id,
            b.booking_reference,
            c.cancellation_date,
            c.cancellation_reason,
            c.refund_amount,
            b.total_amount AS original_booking_amount,
            p.full_name AS passenger_name,
            f.flight_number
        FROM cancellations c
        INNER JOIN bookings b ON c.booking_id = b.booking_id
        INNER JOIN passengers p ON b.passenger_id = p.passenger_id
        INNER JOIN flights f ON b.flight_id = f.flight_id
        ORDER BY c.cancellation_date DESC
    """)
    rows = db.execute(sql).mappings().all()
    return generate_csv_response(rows, "cancellations_report.csv")
