"""
AIR-FLOW: Synthetic Data Generator
File: scripts/generate_dataset.py

Generates realistic airline operational data for the air_flow_db database.
Uses Faker for names/emails and custom logic for airline-specific data.

Targets (from spec):
  ~10 airlines, ~25 airports, ~30 aircraft, ~60 routes,
  ~300-500 flights, ~1000-2000 passengers, ~3000-5000 bookings,
  payments (success + failed), refunds, cancellations, multi-class fares,
  varied occupancy, some BLOCKED seats.

All foreign keys are valid. Data is internally consistent:
  - Confirmed bookings have successful payments
  - Refunds match cancellations
  - Seat inventory matches aircraft layout
  - HELD/CONFIRMED booking_seats cannot conflict

Usage:
  python generate_dataset.py
  (Outputs SQL INSERT statements to stdout or writes to a .sql file)
"""

import random
import hashlib
import json
from datetime import datetime, timedelta
from collections import defaultdict

# We'll try to use Faker, but fall back to built-in data if not installed
try:
    from faker import Faker
    fake = Faker('en_IN')
    Faker.seed(42)
    HAS_FAKER = True
except ImportError:
    HAS_FAKER = False
    print("WARNING: Faker not installed. Using built-in sample names.")

random.seed(42)

# =====================================================================
# CONFIGURATION
# =====================================================================
NUM_AIRLINES = 10
NUM_AIRPORTS = 25
NUM_AIRCRAFT = 30
NUM_ROUTES = 60
NUM_FLIGHTS = 400
NUM_PASSENGERS = 1500
TARGET_BOOKINGS = 4000
CANCELLATION_RATE = 0.12       # ~12% of confirmed bookings get cancelled
FAILED_PAYMENT_RATE = 0.08     # ~8% of payments fail
BLOCKED_SEAT_RATE = 0.03       # ~3% of seats are blocked per flight

# Date range for flights
FLIGHT_START_DATE = datetime(2026, 4, 1)
FLIGHT_END_DATE = datetime(2026, 10, 31)

# =====================================================================
# REFERENCE DATA
# =====================================================================
INDIAN_AIRLINES = [
    ("Air India", "AI", "India"),
    ("IndiGo", "6E", "India"),
    ("SpiceJet", "SG", "India"),
    ("Vistara", "UK", "India"),
    ("Go First", "G8", "India"),
    ("AirAsia India", "I5", "India"),
    ("Akasa Air", "QP", "India"),
    ("Alliance Air", "9I", "India"),
    ("Emirates", "EK", "UAE"),
    ("Singapore Airlines", "SQ", "Singapore"),
]

AIRPORTS = [
    ("DEL", "Indira Gandhi International Airport", "New Delhi", "India"),
    ("BOM", "Chhatrapati Shivaji Maharaj International Airport", "Mumbai", "India"),
    ("BLR", "Kempegowda International Airport", "Bengaluru", "India"),
    ("MAA", "Chennai International Airport", "Chennai", "India"),
    ("CCU", "Netaji Subhas Chandra Bose International Airport", "Kolkata", "India"),
    ("HYD", "Rajiv Gandhi International Airport", "Hyderabad", "India"),
    ("COK", "Cochin International Airport", "Kochi", "India"),
    ("GOI", "Goa International Airport", "Goa", "India"),
    ("AMD", "Sardar Vallabhbhai Patel International Airport", "Ahmedabad", "India"),
    ("PNQ", "Pune Airport", "Pune", "India"),
    ("JAI", "Jaipur International Airport", "Jaipur", "India"),
    ("LKO", "Chaudhary Charan Singh International Airport", "Lucknow", "India"),
    ("IXC", "Chandigarh Airport", "Chandigarh", "India"),
    ("GAU", "Lokpriya Gopinath Bordoloi International Airport", "Guwahati", "India"),
    ("PAT", "Jay Prakash Narayan International Airport", "Patna", "India"),
    ("BBI", "Biju Patnaik International Airport", "Bhubaneswar", "India"),
    ("IXR", "Birsa Munda Airport", "Ranchi", "India"),
    ("VNS", "Lal Bahadur Shastri Airport", "Varanasi", "India"),
    ("SXR", "Sheikh ul-Alam International Airport", "Srinagar", "India"),
    ("IXB", "Bagdogra Airport", "Siliguri", "India"),
    ("DXB", "Dubai International Airport", "Dubai", "UAE"),
    ("SIN", "Changi Airport", "Singapore", "Singapore"),
    ("BKK", "Suvarnabhumi Airport", "Bangkok", "Thailand"),
    ("KUL", "Kuala Lumpur International Airport", "Kuala Lumpur", "Malaysia"),
    ("DOH", "Hamad International Airport", "Doha", "Qatar"),
]

AIRCRAFT_MODELS = [
    # (model, economy_seats, business_seats, first_seats)
    ("Boeing 737-800", 150, 12, 0),
    ("Airbus A320neo", 156, 12, 0),
    ("Boeing 777-300ER", 250, 42, 8),
    ("Airbus A321neo", 180, 16, 0),
    ("ATR 72-600", 68, 0, 0),
    ("Boeing 787-9 Dreamliner", 210, 35, 6),
    ("Airbus A380-800", 380, 76, 14),
    ("Airbus A319", 120, 8, 0),
]

PAYMENT_METHODS = ["CREDIT_CARD", "DEBIT_CARD", "UPI", "NET_BANKING", "WALLET"]
BOOKING_CHANNELS = ["WEBSITE", "MOBILE_APP", "TRAVEL_AGENT", "AIRPORT_COUNTER"]
MEAL_PREFERENCES = ["VEG", "NON_VEG", "VEGAN", "JAIN", None]
CANCELLATION_REASONS = [
    "Schedule change", "Personal reasons", "Medical emergency",
    "Better fare found", "Flight delayed", "Travel plans changed",
    "Visa issues", "Weather concerns", "Work commitment", "Family emergency"
]

# Distance lookup (approximate km between major Indian cities)
DISTANCE_MATRIX = {
    ("DEL", "BOM"): 1400, ("DEL", "BLR"): 2150, ("DEL", "MAA"): 2200,
    ("DEL", "CCU"): 1500, ("DEL", "HYD"): 1550, ("DEL", "GOI"): 1850,
    ("DEL", "AMD"): 950,  ("DEL", "JAI"): 280,  ("DEL", "LKO"): 500,
    ("DEL", "DXB"): 2400, ("DEL", "SIN"): 4200, ("DEL", "BKK"): 3500,
    ("BOM", "BLR"): 980,  ("BOM", "MAA"): 1340, ("BOM", "CCU"): 1950,
    ("BOM", "HYD"): 720,  ("BOM", "GOI"): 550,  ("BOM", "AMD"): 530,
    ("BOM", "PNQ"): 150,  ("BOM", "DXB"): 2000, ("BOM", "SIN"): 4400,
    ("BLR", "MAA"): 350,  ("BLR", "HYD"): 570,  ("BLR", "CCU"): 1870,
    ("BLR", "GOI"): 560,  ("BLR", "COK"): 530,  ("BLR", "SIN"): 3200,
    ("MAA", "HYD"): 630,  ("MAA", "CCU"): 1660, ("MAA", "COK"): 680,
    ("MAA", "SIN"): 3150, ("MAA", "KUL"): 3450, ("MAA", "BKK"): 2850,
    ("CCU", "HYD"): 1500, ("CCU", "GAU"): 600,  ("CCU", "PAT"): 530,
    ("CCU", "BBI"): 440,  ("CCU", "IXB"): 560,  ("CCU", "BKK"): 2500,
    ("HYD", "GOI"): 560,  ("HYD", "COK"): 900,
    ("COK", "GOI"): 400,  ("COK", "DXB"): 2700, ("COK", "DOH"): 3200,
    ("AMD", "JAI"): 670,  ("AMD", "DXB"): 2200,
    ("JAI", "LKO"): 600,  ("JAI", "GOI"): 1500,
    ("LKO", "PAT"): 530,  ("LKO", "VNS"): 280,
    ("GAU", "IXB"): 480,  ("DEL", "SXR"): 680,
    ("DEL", "IXC"): 250,  ("DEL", "VNS"): 800,
    ("DEL", "PAT"): 1000, ("BOM", "COK"): 1340,
    ("DEL", "DOH"): 2800, ("BOM", "BKK"): 4200,
    ("DEL", "KUL"): 4600, ("BLR", "DXB"): 2800,
}

def get_distance(code1, code2):
    """Look up distance between two airports; return a random realistic value if not found."""
    key1 = (code1, code2)
    key2 = (code2, code1)
    if key1 in DISTANCE_MATRIX:
        return DISTANCE_MATRIX[key1]
    elif key2 in DISTANCE_MATRIX:
        return DISTANCE_MATRIX[key2]
    else:
        return random.randint(400, 5000)


def generate_seat_layout(model_info):
    """Generate seat numbers for an aircraft model."""
    model, eco, biz, first = model_info
    seats = []
    row = 1

    # First class: rows 1-N, seats A-D (2+2 layout)
    for _ in range(first):
        col = chr(65 + (len([s for s in seats if s[0] == 'FIRST']) % 4))
        seats.append(('FIRST', f"{row}{col}"))
        if col == 'D':
            row += 1
    if first > 0:
        row += 1  # gap after first class

    # Business class: rows N-M, seats A-F (3+3 layout)
    biz_start = row
    for i in range(biz):
        col = chr(65 + (i % 6))
        seats.append(('BUSINESS', f"{row}{col}"))
        if col == 'F':
            row += 1
    if biz > 0 and (biz % 6) != 0:
        row += 1
    if biz > 0:
        row += 1  # gap

    # Economy: rows M-end, seats A-F (3+3 layout)
    for i in range(eco):
        col = chr(65 + (i % 6))
        seats.append(('ECONOMY', f"{row}{col}"))
        if col == 'F':
            row += 1

    return seats


def generate_booking_reference():
    """Generate a unique booking reference like AF-A1B2C3."""
    chars = '0123456789ABCDEF'
    code = ''.join(random.choices(chars, k=6))
    return f"AF-{code}"


def generate_txn_reference(prefix="TXN"):
    """Generate a unique transaction reference."""
    chars = '0123456789ABCDEF'
    code = ''.join(random.choices(chars, k=12))
    return f"{prefix}-{code}"


def sql_escape(val):
    """Escape a string for SQL insertion."""
    if val is None:
        return "NULL"
    if isinstance(val, str):
        return "'" + val.replace("'", "''").replace("\\", "\\\\") + "'"
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, datetime):
        return f"'{val.strftime('%Y-%m-%d %H:%M:%S')}'"
    if isinstance(val, dict):
        return sql_escape(json.dumps(val))
    return str(val)


def generate_passenger_name(i):
    """Generate a realistic Indian passenger name."""
    if HAS_FAKER:
        return fake.name()
    first_names = [
        "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh",
        "Ayaan", "Krishna", "Ishaan", "Ananya", "Diya", "Myra", "Aadhya",
        "Priya", "Neha", "Kavya", "Isha", "Riya", "Sara", "Rohan", "Karan",
        "Amit", "Rahul", "Vijay", "Suresh", "Deepa", "Lakshmi", "Meera", "Pooja"
    ]
    last_names = [
        "Sharma", "Verma", "Patel", "Singh", "Kumar", "Gupta", "Reddy",
        "Nair", "Iyer", "Das", "Joshi", "Mehta", "Shah", "Rao", "Pillai",
        "Chopra", "Malhotra", "Kapoor", "Bhat", "Desai", "Mishra", "Tiwari"
    ]
    return f"{random.choice(first_names)} {random.choice(last_names)}"


def generate_email(name, i):
    """Generate a unique email from a name."""
    if HAS_FAKER:
        return f"{name.lower().replace(' ', '.')}.{i}@{'gmail.com' if random.random() > 0.3 else 'yahoo.com'}"
    clean = name.lower().replace(' ', '.').replace("'", "")
    return f"{clean}.{i}@{'gmail.com' if random.random() > 0.3 else 'yahoo.com'}"


def generate_phone():
    """Generate an Indian phone number."""
    return f"+91-{random.choice(['9','8','7'])}{random.randint(100000000, 999999999)}"


class DataGenerator:
    """Generates all data and outputs SQL INSERT statements."""

    def __init__(self):
        self.airlines = []
        self.airports = []
        self.aircraft = []
        self.aircraft_seats = []  # (aircraft_id, seat_number, seat_class)
        self.routes = []
        self.flights = []
        self.flight_seats = []    # (flight_id, aircraft_seat_id, status)
        self.passengers = []
        self.bookings = []
        self.booking_seats = []
        self.payments = []
        self.fares = []
        self.cancellations = []
        self.users = []

        # Tracking
        self.booking_refs = set()
        self.txn_refs = set()
        self.aircraft_seat_id_counter = 0
        self.flight_seat_id_counter = 0
        self.booking_id_counter = 0
        self.payment_id_counter = 0

        # Maps for lookups
        self.aircraft_to_seats = defaultdict(list)   # aircraft_id -> [seat_ids]
        self.flight_to_seats = {}      # flight_id -> {flight_seat_id: (aircraft_seat_id, status, seat_class)}
        self.flight_to_aircraft = {}   # flight_id -> aircraft_id
        self.flight_to_airline = {}    # flight_id -> airline_id
        self.flight_info = {}          # flight_id -> (departure_time, flight_status)

    def generate_all(self):
        """Generate all data in dependency order."""
        print("-- Generating airlines...")
        self._gen_airlines()
        print("-- Generating airports...")
        self._gen_airports()
        print("-- Generating aircraft and seat layouts...")
        self._gen_aircraft()
        print("-- Generating routes...")
        self._gen_routes()
        print("-- Generating flights and flight seat inventory...")
        self._gen_flights()
        print("-- Generating fares...")
        self._gen_fares()
        print("-- Generating passengers...")
        self._gen_passengers()
        print("-- Generating bookings, payments, and cancellations...")
        self._gen_bookings()
        print("-- Generating users...")
        self._gen_users()
        print("-- Data generation complete.")

    def _gen_airlines(self):
        for i, (name, code, country) in enumerate(INDIAN_AIRLINES[:NUM_AIRLINES], 1):
            self.airlines.append((i, name, code, country))

    def _gen_airports(self):
        for i, (code, name, city, country) in enumerate(AIRPORTS[:NUM_AIRPORTS], 1):
            self.airports.append((i, code, name, city, country))

    def _gen_aircraft(self):
        seat_id = 1
        for i in range(1, NUM_AIRCRAFT + 1):
            airline_id = random.randint(1, NUM_AIRLINES)
            model_info = random.choice(AIRCRAFT_MODELS)
            model = model_info[0]
            reg = f"VT-{chr(65 + (i // 26))}{chr(65 + (i % 26))}{random.randint(0,9)}"

            seats = generate_seat_layout(model_info)
            total_capacity = len(seats)

            self.aircraft.append((i, airline_id, reg, model, total_capacity))

            for seat_class, seat_number in seats:
                self.aircraft_seats.append((seat_id, i, seat_number, seat_class))
                self.aircraft_to_seats[i].append(seat_id)
                seat_id += 1

            self.aircraft_seat_id_counter = seat_id - 1

    def _gen_routes(self):
        airport_codes = [a[1] for a in self.airports]
        airport_id_map = {a[1]: a[0] for a in self.airports}

        route_set = set()
        route_id = 1

        # Generate routes ensuring no duplicates and no self-loops
        while len(self.routes) < NUM_ROUTES:
            orig = random.choice(airport_codes)
            dest = random.choice(airport_codes)
            if orig == dest or (orig, dest) in route_set:
                continue
            route_set.add((orig, dest))
            dist = get_distance(orig, dest)
            self.routes.append((route_id, airport_id_map[orig], airport_id_map[dest], dist))
            route_id += 1

    def _gen_flights(self):
        fs_id = 1  # flight_seat_id counter

        for flight_id in range(1, NUM_FLIGHTS + 1):
            airline_id = random.randint(1, NUM_AIRLINES)
            # Pick an aircraft belonging to this airline or any (realistic mix)
            airline_aircraft = [a for a in self.aircraft if a[1] == airline_id]
            if not airline_aircraft:
                airline_aircraft = self.aircraft
            ac = random.choice(airline_aircraft)
            aircraft_id = ac[0]

            route = random.choice(self.routes)
            route_id = route[0]

            # Generate departure time with weekday/weekend and seasonal patterns
            days_range = (FLIGHT_END_DATE - FLIGHT_START_DATE).days
            dep_date = FLIGHT_START_DATE + timedelta(days=random.randint(0, days_range))
            # More flights on weekdays
            if dep_date.weekday() >= 5:  # weekend
                if random.random() > 0.7:  # 30% chance to skip weekend
                    dep_date += timedelta(days=random.randint(1, 2))
            dep_hour = random.choice([6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20, 21])
            dep_minute = random.choice([0, 15, 30, 45])
            dep_time = dep_date.replace(hour=dep_hour, minute=dep_minute, second=0)

            # Duration based on distance
            dist = route[3]
            duration_hours = max(1, dist / 800)  # ~800 km/h average
            duration_minutes = int(duration_hours * 60) + random.randint(-15, 30)
            arr_time = dep_time + timedelta(minutes=max(60, duration_minutes))

            # Flight number
            airline_code = self.airlines[airline_id - 1][2]
            fnum = f"{airline_code}-{random.randint(100, 999)}"

            # Status: most completed or scheduled, some cancelled
            if dep_time < datetime(2026, 9, 1):
                status = random.choices(
                    ['COMPLETED', 'CANCELLED'],
                    weights=[92, 8]
                )[0]
            else:
                status = random.choices(
                    ['SCHEDULED', 'COMPLETED', 'CANCELLED'],
                    weights=[60, 30, 10]
                )[0]

            self.flights.append((flight_id, airline_id, aircraft_id, route_id,
                                 fnum, dep_time, arr_time, status))
            self.flight_to_aircraft[flight_id] = aircraft_id
            self.flight_to_airline[flight_id] = airline_id
            self.flight_info[flight_id] = (dep_time, status)

            # Create flight_seats from aircraft_seats
            seat_ids = self.aircraft_to_seats[aircraft_id]
            flight_seat_map = {}
            for ac_seat_id in seat_ids:
                # Find the seat class for this aircraft_seat_id
                seat_record = next(s for s in self.aircraft_seats if s[0] == ac_seat_id)
                seat_class = seat_record[3]

                # Determine initial status: mostly AVAILABLE, some BLOCKED
                if random.random() < BLOCKED_SEAT_RATE:
                    seat_status = 'BLOCKED'
                else:
                    seat_status = 'AVAILABLE'

                self.flight_seats.append((fs_id, flight_id, ac_seat_id, seat_status))
                flight_seat_map[fs_id] = (ac_seat_id, seat_status, seat_class)
                fs_id += 1

            self.flight_to_seats[flight_id] = flight_seat_map

        self.flight_seat_id_counter = fs_id - 1

    def _gen_fares(self):
        fare_id = 1
        for flight_id in range(1, NUM_FLIGHTS + 1):
            dep_time = self.flight_info[flight_id][0]
            valid_from = (dep_time - timedelta(days=90)).date()

            # Economy fare
            eco_fare = random.randint(2500, 12000)
            self.fares.append((fare_id, flight_id, 'ECONOMY', eco_fare, 'INR',
                               valid_from, None))
            fare_id += 1

            # Business fare (2.5x to 4x economy)
            biz_fare = int(eco_fare * random.uniform(2.5, 4.0))
            self.fares.append((fare_id, flight_id, 'BUSINESS', biz_fare, 'INR',
                               valid_from, None))
            fare_id += 1

            # First class fare (if aircraft has first class seats)
            aircraft_id = self.flight_to_aircraft[flight_id]
            has_first = any(s[3] == 'FIRST' for s in self.aircraft_seats if s[1] == aircraft_id)
            if has_first:
                first_fare = int(eco_fare * random.uniform(5.0, 8.0))
                self.fares.append((fare_id, flight_id, 'FIRST', first_fare, 'INR',
                                   valid_from, None))
                fare_id += 1

    def _gen_passengers(self):
        for i in range(1, NUM_PASSENGERS + 1):
            name = generate_passenger_name(i)
            email = generate_email(name, i)
            phone = generate_phone()
            self.passengers.append((i, name, email, phone))

    def _gen_bookings(self):
        booking_id = 1
        payment_id = 1
        cancellation_id = 1

        # Track which flight_seats are booked (by flight_seat_id)
        booked_seats = set()

        # Get bookable flights (not cancelled)
        bookable_flights = [f for f in self.flights if f[7] != 'CANCELLED']

        booking_count = 0
        attempts = 0
        max_attempts = TARGET_BOOKINGS * 3

        while booking_count < TARGET_BOOKINGS and attempts < max_attempts:
            attempts += 1

            flight = random.choice(bookable_flights)
            flight_id = flight[0]
            passenger_id = random.randint(1, NUM_PASSENGERS)

            # Get available seats for this flight
            available = [
                (fs_id, info)
                for fs_id, info in self.flight_to_seats[flight_id].items()
                if info[1] == 'AVAILABLE' and fs_id not in booked_seats
            ]

            if len(available) < 1:
                continue

            # Choose 1-3 seats (mostly 1)
            num_seats = random.choices([1, 2, 3], weights=[75, 20, 5])[0]
            num_seats = min(num_seats, len(available))
            chosen_seats = random.sample(available, num_seats)

            # Generate booking reference (unique)
            while True:
                ref = generate_booking_reference()
                if ref not in self.booking_refs:
                    self.booking_refs.add(ref)
                    break

            # Calculate fare
            total_fare = 0
            for fs_id, (ac_seat_id, _, seat_class) in chosen_seats:
                # Find the fare for this flight and class
                matching_fares = [f for f in self.fares
                                  if f[1] == flight_id and f[2] == seat_class]
                if matching_fares:
                    total_fare += matching_fares[0][3]
                else:
                    total_fare += 5000  # fallback

            # Booking date: 1-60 days before departure
            dep_time = self.flight_info[flight_id][0]
            book_days_before = random.randint(1, 60)
            booking_date = dep_time - timedelta(days=book_days_before,
                                                 hours=random.randint(0, 23),
                                                 minutes=random.randint(0, 59))

            # Generate metadata
            metadata = {
                "booking_channel": random.choice(BOOKING_CHANNELS),
                "meal_preference": random.choice(MEAL_PREFERENCES),
                "baggage_kg": random.choice([15, 20, 25, 30, 35]),
            }
            if metadata["meal_preference"] is None:
                del metadata["meal_preference"]

            # Decide payment outcome
            is_failed = random.random() < FAILED_PAYMENT_RATE

            if is_failed:
                booking_status = 'CANCELLED'
                seat_status_bs = 'CANCELLED'
            else:
                booking_status = 'CONFIRMED'
                seat_status_bs = 'CONFIRMED'

            # Create booking
            self.bookings.append((
                booking_id, ref, passenger_id, flight_id,
                booking_date, booking_status, total_fare, metadata
            ))

            # Create booking_seats
            for fs_id, (ac_seat_id, _, seat_class) in chosen_seats:
                self.booking_seats.append((
                    len(self.booking_seats) + 1,
                    booking_id, fs_id, seat_status_bs
                ))
                if not is_failed:
                    booked_seats.add(fs_id)
                    # Update flight_seats status in our tracking
                    old_info = self.flight_to_seats[flight_id][fs_id]
                    self.flight_to_seats[flight_id][fs_id] = (old_info[0], 'BOOKED', old_info[2])

            # Create payment
            while True:
                txn = generate_txn_reference("TXN")
                if txn not in self.txn_refs:
                    self.txn_refs.add(txn)
                    break

            payment_method = random.choice(PAYMENT_METHODS)
            payment_status = 'FAILED' if is_failed else 'SUCCESS'

            self.payments.append((
                payment_id, booking_id, total_fare, payment_method,
                'PAYMENT', payment_status, txn,
                booking_date + timedelta(minutes=random.randint(1, 30))
            ))
            payment_id += 1

            # Handle cancellations (only for confirmed bookings)
            if not is_failed and random.random() < CANCELLATION_RATE:
                # This booking will be cancelled
                cancel_date = booking_date + timedelta(
                    days=random.randint(1, max(1, book_days_before - 1)),
                    hours=random.randint(0, 23)
                )
                reason = random.choice(CANCELLATION_REASONS)

                # Calculate refund based on time before departure
                hours_before = (dep_time - cancel_date).total_seconds() / 3600
                if hours_before <= 0:
                    refund_pct = 0
                elif hours_before < 12:
                    refund_pct = 0.25
                elif hours_before < 24:
                    refund_pct = 0.50
                elif hours_before < 72:
                    refund_pct = 0.70
                else:
                    refund_pct = 0.90

                refund_amount = round(total_fare * refund_pct, 2)

                # Update booking status to CANCELLED
                self.bookings[-1] = (
                    booking_id, ref, passenger_id, flight_id,
                    booking_date, 'CANCELLED', total_fare, metadata
                )

                # Update booking_seats to CANCELLED
                for j in range(len(self.booking_seats) - num_seats, len(self.booking_seats)):
                    old = self.booking_seats[j]
                    self.booking_seats[j] = (old[0], old[1], old[2], 'CANCELLED')

                # Release seats
                for fs_id, (ac_seat_id, _, seat_class) in chosen_seats:
                    booked_seats.discard(fs_id)
                    old_info = self.flight_to_seats[flight_id][fs_id]
                    self.flight_to_seats[flight_id][fs_id] = (old_info[0], 'AVAILABLE', old_info[2])

                # Record cancellation
                self.cancellations.append((
                    cancellation_id, booking_id, cancel_date, reason, refund_amount
                ))
                cancellation_id += 1

                # Record refund payment
                if refund_amount > 0:
                    while True:
                        rtxn = generate_txn_reference("REF")
                        if rtxn not in self.txn_refs:
                            self.txn_refs.add(rtxn)
                            break

                    self.payments.append((
                        payment_id, booking_id, refund_amount, payment_method,
                        'REFUND', 'SUCCESS', rtxn,
                        cancel_date + timedelta(minutes=random.randint(5, 120))
                    ))
                    payment_id += 1

            booking_id += 1
            booking_count += 1

        self.booking_id_counter = booking_id - 1
        self.payment_id_counter = payment_id - 1

    def _gen_users(self):
        """Generate demo users with bcrypt-hashed passwords."""
        try:
            import bcrypt
            admin_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt(12)).decode('utf-8')
            analyst_hash = bcrypt.hashpw(b"analyst123", bcrypt.gensalt(12)).decode('utf-8')
        except Exception:
            # Fallback: pre-computed standard bcrypt hashes
            admin_hash = "$2b$12$LJ3m4ys3LzDfNJKlBSTvKOhVGK0MZvdkCYVn1.xKZXqEqFEONzJLi"
            analyst_hash = "$2b$12$5Fz3xMKn7vH1UXo9oV9ByO7KqR8xZpW4QMn0NmL3kH9RvT6YjE2ua"

        self.users = [
            (1, "admin", "admin@airflow.com", admin_hash, "ADMIN"),
            (2, "analyst", "analyst@airflow.com", analyst_hash, "ANALYST"),
        ]

    def output_sql(self, filepath=None):
        """Output all INSERT statements as SQL."""
        lines = []
        lines.append("-- =====================================================================")
        lines.append("-- AIR-FLOW: Generated Dataset")
        lines.append(f"-- Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"-- Airlines: {len(self.airlines)}")
        lines.append(f"-- Airports: {len(self.airports)}")
        lines.append(f"-- Aircraft: {len(self.aircraft)}")
        lines.append(f"-- Aircraft Seats: {len(self.aircraft_seats)}")
        lines.append(f"-- Routes: {len(self.routes)}")
        lines.append(f"-- Flights: {len(self.flights)}")
        lines.append(f"-- Flight Seats: {len(self.flight_seats)}")
        lines.append(f"-- Passengers: {len(self.passengers)}")
        lines.append(f"-- Bookings: {len(self.bookings)}")
        lines.append(f"-- Booking Seats: {len(self.booking_seats)}")
        lines.append(f"-- Payments: {len(self.payments)}")
        lines.append(f"-- Fares: {len(self.fares)}")
        lines.append(f"-- Cancellations: {len(self.cancellations)}")
        lines.append(f"-- Users: {len(self.users)}")
        lines.append("-- =====================================================================")
        lines.append("")
        lines.append("USE air_flow_db;")
        lines.append("")
        lines.append("SET FOREIGN_KEY_CHECKS = 0;")
        lines.append("SET UNIQUE_CHECKS = 0;")
        lines.append("SET autocommit = 0;")
        lines.append("")

        # Airlines
        lines.append("-- Airlines")
        for a in self.airlines:
            lines.append(
                f"INSERT INTO airlines (airline_id, airline_name, airline_code, country) "
                f"VALUES ({a[0]}, {sql_escape(a[1])}, {sql_escape(a[2])}, {sql_escape(a[3])});"
            )
        lines.append("")

        # Airports
        lines.append("-- Airports")
        for a in self.airports:
            lines.append(
                f"INSERT INTO airports (airport_id, airport_code, airport_name, city, country) "
                f"VALUES ({a[0]}, {sql_escape(a[1])}, {sql_escape(a[2])}, {sql_escape(a[3])}, {sql_escape(a[4])});"
            )
        lines.append("")

        # Aircraft
        lines.append("-- Aircraft")
        for a in self.aircraft:
            lines.append(
                f"INSERT INTO aircraft (aircraft_id, airline_id, registration_number, model, total_capacity) "
                f"VALUES ({a[0]}, {a[1]}, {sql_escape(a[2])}, {sql_escape(a[3])}, {a[4]});"
            )
        lines.append("")

        # Aircraft Seats (bulk insert for performance)
        lines.append("-- Aircraft Seats")
        batch_size = 100
        for i in range(0, len(self.aircraft_seats), batch_size):
            batch = self.aircraft_seats[i:i + batch_size]
            values = ", ".join(
                f"({s[0]}, {s[1]}, {sql_escape(s[2])}, {sql_escape(s[3])})"
                for s in batch
            )
            lines.append(
                f"INSERT INTO aircraft_seats (aircraft_seat_id, aircraft_id, seat_number, seat_class) "
                f"VALUES {values};"
            )
        lines.append("")

        # Routes
        lines.append("-- Routes")
        for r in self.routes:
            lines.append(
                f"INSERT INTO routes (route_id, origin_airport_id, destination_airport_id, distance_km) "
                f"VALUES ({r[0]}, {r[1]}, {r[2]}, {r[3]});"
            )
        lines.append("")

        # Flights
        lines.append("-- Flights")
        for f in self.flights:
            lines.append(
                f"INSERT INTO flights (flight_id, airline_id, aircraft_id, route_id, flight_number, "
                f"departure_time, arrival_time, flight_status) "
                f"VALUES ({f[0]}, {f[1]}, {f[2]}, {f[3]}, {sql_escape(f[4])}, "
                f"{sql_escape(f[5])}, {sql_escape(f[6])}, {sql_escape(f[7])});"
            )
        lines.append("")

        # Flight Seats (bulk)
        lines.append("-- Flight Seats")
        # Update statuses based on what actually got booked
        updated_flight_seats = []
        for fs in self.flight_seats:
            fs_id = fs[0]
            flight_id = fs[1]
            actual_info = self.flight_to_seats[flight_id].get(fs_id)
            if actual_info:
                status = actual_info[1]
            else:
                status = fs[3]
            updated_flight_seats.append((fs[0], fs[1], fs[2], status))

        for i in range(0, len(updated_flight_seats), batch_size):
            batch = updated_flight_seats[i:i + batch_size]
            values = ", ".join(
                f"({s[0]}, {s[1]}, {s[2]}, {sql_escape(s[3])})"
                for s in batch
            )
            lines.append(
                f"INSERT INTO flight_seats (flight_seat_id, flight_id, aircraft_seat_id, seat_status) "
                f"VALUES {values};"
            )
        lines.append("")

        # Fares
        lines.append("-- Fares")
        for f in self.fares:
            valid_until = sql_escape(f[6]) if f[6] else "NULL"
            lines.append(
                f"INSERT INTO fares (fare_id, flight_id, fare_class, base_fare, currency, valid_from, valid_until) "
                f"VALUES ({f[0]}, {f[1]}, {sql_escape(f[2])}, {f[3]}, {sql_escape(f[4])}, "
                f"'{f[5]}', {valid_until});"
            )
        lines.append("")

        # Passengers
        lines.append("-- Passengers")
        for p in self.passengers:
            lines.append(
                f"INSERT INTO passengers (passenger_id, full_name, email, phone) "
                f"VALUES ({p[0]}, {sql_escape(p[1])}, {sql_escape(p[2])}, {sql_escape(p[3])});"
            )
        lines.append("")

        # Bookings
        lines.append("-- Bookings")
        for b in self.bookings:
            meta = sql_escape(b[7]) if b[7] else "NULL"
            lines.append(
                f"INSERT INTO bookings (booking_id, booking_reference, passenger_id, flight_id, "
                f"booking_date, booking_status, total_amount, booking_metadata) "
                f"VALUES ({b[0]}, {sql_escape(b[1])}, {b[2]}, {b[3]}, "
                f"{sql_escape(b[4])}, {sql_escape(b[5])}, {b[6]}, {meta});"
            )
        lines.append("")

        # Booking Seats
        lines.append("-- Booking Seats")
        for bs_batch_start in range(0, len(self.booking_seats), batch_size):
            batch = self.booking_seats[bs_batch_start:bs_batch_start + batch_size]
            values = ", ".join(
                f"({s[0]}, {s[1]}, {s[2]}, {sql_escape(s[3])})"
                for s in batch
            )
            lines.append(
                f"INSERT INTO booking_seats (booking_seat_id, booking_id, flight_seat_id, seat_status) "
                f"VALUES {values};"
            )
        lines.append("")

        # Payments
        lines.append("-- Payments")
        for p in self.payments:
            lines.append(
                f"INSERT INTO payments (payment_id, booking_id, amount, payment_method, "
                f"payment_type, payment_status, transaction_reference, payment_date) "
                f"VALUES ({p[0]}, {p[1]}, {p[2]}, {sql_escape(p[3])}, "
                f"{sql_escape(p[4])}, {sql_escape(p[5])}, {sql_escape(p[6])}, {sql_escape(p[7])});"
            )
        lines.append("")

        # Cancellations
        lines.append("-- Cancellations")
        for c in self.cancellations:
            lines.append(
                f"INSERT INTO cancellations (cancellation_id, booking_id, cancellation_date, "
                f"cancellation_reason, refund_amount) "
                f"VALUES ({c[0]}, {c[1]}, {sql_escape(c[2])}, {sql_escape(c[3])}, {c[4]});"
            )
        lines.append("")

        # Users
        lines.append("-- Users (demo accounts)")
        for u in self.users:
            lines.append(
                f"INSERT INTO users (user_id, username, email, password_hash, role) "
                f"VALUES ({u[0]}, {sql_escape(u[1])}, {sql_escape(u[2])}, {sql_escape(u[3])}, {sql_escape(u[4])});"
            )
        lines.append("")

        lines.append("SET FOREIGN_KEY_CHECKS = 1;")
        lines.append("SET UNIQUE_CHECKS = 1;")
        lines.append("COMMIT;")
        lines.append("")
        lines.append("-- End of generated dataset")

        sql_output = "\n".join(lines)

        if filepath:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(sql_output)
            print(f"-- Written to {filepath}")
            print(f"-- Total lines: {len(lines)}")
        else:
            print(sql_output)

        return sql_output


if __name__ == "__main__":
    import os
    gen = DataGenerator()
    gen.generate_all()

    # Output to file in the database directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)
    output_path = os.path.join(project_dir, "database", "seed_data.sql")
    gen.output_sql(output_path)

    # Print summary
    print(f"\n-- Summary:")
    print(f"--   Airlines:       {len(gen.airlines)}")
    print(f"--   Airports:       {len(gen.airports)}")
    print(f"--   Aircraft:       {len(gen.aircraft)}")
    print(f"--   Aircraft Seats: {len(gen.aircraft_seats)}")
    print(f"--   Routes:         {len(gen.routes)}")
    print(f"--   Flights:        {len(gen.flights)}")
    print(f"--   Flight Seats:   {len(gen.flight_seats)}")
    print(f"--   Passengers:     {len(gen.passengers)}")
    print(f"--   Bookings:       {len(gen.bookings)}")
    print(f"--   Booking Seats:  {len(gen.booking_seats)}")
    print(f"--   Payments:       {len(gen.payments)}")
    print(f"--   Fares:          {len(gen.fares)}")
    print(f"--   Cancellations:  {len(gen.cancellations)}")
    print(f"--   Users:          {len(gen.users)}")

