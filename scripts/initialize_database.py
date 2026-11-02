"""
AIR-FLOW: Database Initialization Script
File: scripts/initialize_database.py

Drops and recreates the air_flow_db database from scratch:
  1. Drops air_flow_db if it exists
  2. Runs schema.sql (creates tables, event)
  3. Runs indexes.sql (performance indexes)
  4. Runs triggers.sql (audit log table + triggers)
  5. Runs procedures.sql (stored procedures)
  6. Generates synthetic data via generate_dataset.py
  7. Loads seed_data.sql into the database
  8. Runs views.sql (analytics views — after data so we can test them)
  9. Enables the MySQL event scheduler
  10. Runs a quick verification

Usage:
  cd scripts
  python initialize_database.py

Reads DB credentials from backend/.env or uses defaults.
"""

import os
import sys
import subprocess
import time

# =====================================================================
# CONFIGURATION
# =====================================================================
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
DATABASE_DIR = os.path.join(PROJECT_DIR, "database")
BACKEND_DIR = os.path.join(PROJECT_DIR, "backend")

# MySQL client path (Windows default)
MYSQL_CLIENT = r"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"

# Default credentials (overridden by .env)
DB_HOST = "localhost"
DB_PORT = "3306"
DB_USER = "root"
DB_PASSWORD = ""
DB_NAME = "air_flow_db"


def load_env():
    """Load database credentials from backend/.env file."""
    global DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

    env_file = os.path.join(BACKEND_DIR, ".env")
    if not os.path.exists(env_file):
        print(f"WARNING: {env_file} not found. Using defaults.")
        return

    with open(env_file, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip()
                if key == 'DB_HOST':
                    DB_HOST = value
                elif key == 'DB_PORT':
                    DB_PORT = value
                elif key == 'DB_USER':
                    DB_USER = value
                elif key == 'DB_PASSWORD':
                    DB_PASSWORD = value
                elif key == 'DB_NAME':
                    DB_NAME = value

    print(f"Loaded credentials: {DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME}")


def run_mysql_command(sql, use_db=True):
    """Execute a SQL string via the MySQL client."""
    cmd = [MYSQL_CLIENT, f"-u{DB_USER}", f"-p{DB_PASSWORD}",
           f"-h{DB_HOST}", f"-P{DB_PORT}"]
    if use_db:
        cmd.append(DB_NAME)
    cmd.append("-e")
    cmd.append(sql)

    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    if result.returncode != 0:
        stderr = result.stderr.replace("mysql: [Warning] Using a password on the command line interface can be insecure.\n", "")
        if stderr.strip():
            print(f"  ERROR: {stderr.strip()}")
        return False, result.stdout
    return True, result.stdout


def run_sql_file(filepath, use_db=True):
    """Execute a SQL file via the MySQL client."""
    if not os.path.exists(filepath):
        print(f"  ERROR: File not found: {filepath}")
        return False

    cmd = [MYSQL_CLIENT, f"-u{DB_USER}", f"-p{DB_PASSWORD}",
           f"-h{DB_HOST}", f"-P{DB_PORT}"]
    if use_db:
        cmd.append(DB_NAME)

    with open(filepath, 'r', encoding='utf-8') as f:
        result = subprocess.run(cmd, stdin=f, capture_output=True, text=True, encoding='utf-8')

    if result.returncode != 0:
        stderr = result.stderr.replace("mysql: [Warning] Using a password on the command line interface can be insecure.\n", "")
        if stderr.strip():
            print(f"  ERROR: {stderr.strip()}")
        return False

    return True


def step(num, description):
    """Print a step header."""
    print(f"\n{'='*60}")
    print(f"  Step {num}: {description}")
    print(f"{'='*60}")


def main():
    print("=" * 60)
    print("  AIR-FLOW Database Initialization")
    print("=" * 60)

    load_env()

    # Verify MySQL client exists
    if not os.path.exists(MYSQL_CLIENT):
        print(f"ERROR: MySQL client not found at {MYSQL_CLIENT}")
        print("Please update MYSQL_CLIENT path in this script.")
        sys.exit(1)

    # Test connection
    print("\nTesting MySQL connection...")
    ok, out = run_mysql_command("SELECT VERSION() AS version;", use_db=False)
    if not ok:
        print("ERROR: Cannot connect to MySQL. Check credentials in backend/.env")
        sys.exit(1)
    print(f"  Connected. {out.strip()}")

    # Step 1: Drop and create database
    step(1, "Drop and create database")
    run_mysql_command(f"DROP DATABASE IF EXISTS {DB_NAME};", use_db=False)
    print(f"  Dropped {DB_NAME} (if existed)")

    # Step 2: Run schema.sql (creates database and tables)
    step(2, "Create schema (14 tables + event)")
    schema_file = os.path.join(DATABASE_DIR, "schema.sql")
    if not run_sql_file(schema_file, use_db=False):
        print("FATAL: Schema creation failed.")
        sys.exit(1)
    print("  Schema created successfully.")

    # Verify tables
    ok, out = run_mysql_command("SHOW TABLES;")
    if ok:
        tables = [line for line in out.strip().split('\n') if line and not line.startswith('Tables_in')]
        print(f"  Tables created: {len(tables)}")
        for t in tables:
            print(f"    - {t}")

    # Step 3: Run indexes.sql
    step(3, "Create performance indexes")
    idx_file = os.path.join(DATABASE_DIR, "indexes.sql")
    if run_sql_file(idx_file):
        print("  Indexes created successfully.")
    else:
        print("  WARNING: Some indexes may have failed (non-fatal).")

    # Step 4: Run triggers.sql (creates audit_log table + triggers)
    step(4, "Create triggers and audit_log table")
    trg_file = os.path.join(DATABASE_DIR, "triggers.sql")
    if run_sql_file(trg_file):
        print("  Triggers created successfully.")
    else:
        print("  WARNING: Some triggers may have failed.")

    # Step 5: Run procedures.sql
    step(5, "Create stored procedures")
    proc_file = os.path.join(DATABASE_DIR, "procedures.sql")
    if run_sql_file(proc_file):
        print("  Stored procedures created successfully.")
    else:
        print("  WARNING: Some procedures may have failed.")

    # Step 6: Generate synthetic data
    step(6, "Generate synthetic data")
    gen_script = os.path.join(SCRIPT_DIR, "generate_dataset.py")
    result = subprocess.run(
        [sys.executable, gen_script],
        capture_output=True, text=True, encoding='utf-8',
        cwd=SCRIPT_DIR
    )
    if result.returncode != 0:
        print(f"  ERROR generating data: {result.stderr}")
        sys.exit(1)
    print(result.stdout)

    # Step 7: Load seed data
    step(7, "Load seed data into database")
    seed_file = os.path.join(DATABASE_DIR, "seed_data.sql")
    if not os.path.exists(seed_file):
        print(f"  ERROR: Seed file not found: {seed_file}")
        sys.exit(1)

    start_time = time.time()
    if run_sql_file(seed_file):
        elapsed = time.time() - start_time
        print(f"  Data loaded successfully in {elapsed:.1f} seconds.")
    else:
        print("  ERROR loading seed data.")
        sys.exit(1)

    # Step 8: Run views.sql (after data so we can verify them)
    step(8, "Create analytics views")
    views_file = os.path.join(DATABASE_DIR, "views.sql")
    if run_sql_file(views_file):
        print("  Views created successfully.")
    else:
        print("  WARNING: Some views may have failed.")

    # Step 9: Enable event scheduler
    step(9, "Enable MySQL event scheduler")
    run_mysql_command("SET GLOBAL event_scheduler = ON;", use_db=False)
    print("  Event scheduler enabled.")

    # Step 10: Verification
    step(10, "Verification")
    verify_queries = [
        ("Table row counts", """
            SELECT 'airlines' AS tbl, COUNT(*) AS cnt FROM airlines
            UNION ALL SELECT 'airports', COUNT(*) FROM airports
            UNION ALL SELECT 'aircraft', COUNT(*) FROM aircraft
            UNION ALL SELECT 'aircraft_seats', COUNT(*) FROM aircraft_seats
            UNION ALL SELECT 'routes', COUNT(*) FROM routes
            UNION ALL SELECT 'flights', COUNT(*) FROM flights
            UNION ALL SELECT 'flight_seats', COUNT(*) FROM flight_seats
            UNION ALL SELECT 'passengers', COUNT(*) FROM passengers
            UNION ALL SELECT 'bookings', COUNT(*) FROM bookings
            UNION ALL SELECT 'booking_seats', COUNT(*) FROM booking_seats
            UNION ALL SELECT 'payments', COUNT(*) FROM payments
            UNION ALL SELECT 'fares', COUNT(*) FROM fares
            UNION ALL SELECT 'cancellations', COUNT(*) FROM cancellations
            UNION ALL SELECT 'users', COUNT(*) FROM users
            UNION ALL SELECT 'audit_log', COUNT(*) FROM audit_log;
        """),
        ("Revenue verification", """
            SELECT
                ROUND(SUM(CASE WHEN payment_type='PAYMENT' AND payment_status='SUCCESS'
                               THEN amount ELSE 0 END), 2) AS gross_revenue,
                ROUND(SUM(CASE WHEN payment_type='REFUND' AND payment_status='SUCCESS'
                               THEN amount ELSE 0 END), 2) AS total_refunds,
                ROUND(SUM(CASE WHEN payment_type='PAYMENT' AND payment_status='SUCCESS'
                               THEN amount ELSE 0 END)
                    - SUM(CASE WHEN payment_type='REFUND' AND payment_status='SUCCESS'
                               THEN amount ELSE 0 END), 2) AS net_revenue
            FROM payments;
        """),
        ("Booking status distribution", """
            SELECT booking_status, COUNT(*) AS count
            FROM bookings GROUP BY booking_status;
        """),
        ("Sample view test (vw_monthly_revenue)", """
            SELECT * FROM vw_monthly_revenue LIMIT 5;
        """),
        ("Users created", """
            SELECT user_id, username, role FROM users;
        """),
    ]

    for desc, query in verify_queries:
        print(f"\n  {desc}:")
        ok, out = run_mysql_command(query)
        if ok and out.strip():
            for line in out.strip().split('\n'):
                print(f"    {line}")
        elif not ok:
            print(f"    FAILED")

    print("\n" + "=" * 60)
    print("  DATABASE INITIALIZATION COMPLETE")
    print("=" * 60)
    print(f"\n  Database: {DB_NAME}")
    print(f"  Host:     {DB_HOST}:{DB_PORT}")
    print(f"  User:     {DB_USER}")
    print("\n  Demo credentials:")
    print("    Admin:   admin / admin123")
    print("    Analyst: analyst / analyst123")
    print()


if __name__ == "__main__":
    main()

