import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Ticket,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Ban,
  Clock,
  DollarSign,
  AlertCircle,
  Armchair,
  CreditCard
} from 'lucide-react';

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Booking Wizard Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [flights, setFlights] = useState([]);
  const [passengers, setPassengers] = useState([]);
  const [selectedFlightId, setSelectedFlightId] = useState('');
  const [selectedPassengerId, setSelectedPassengerId] = useState('');
  const [availableSeats, setAvailableSeats] = useState([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [simulateFail, setSimulateFail] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // Cancel Modal State
  const [cancelBookingId, setCancelBookingId] = useState(null);
  const [cancelReason, setCancelReason] = useState('Customer requested schedule change');
  const [cancelLoading, setCancelLoading] = useState(false);

  const fetchBookings = () => {
    setLoading(true);
    let url = '/bookings?limit=100';
    if (statusFilter) url += `&booking_status=${statusFilter}`;
    if (search) url += `&search=${search}`;

    api.get(url)
      .then((res) => setBookings(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBookings();
  }, [statusFilter]);

  const openNewBookingModal = async () => {
    setModalError('');
    setSelectedSeatIds([]);
    setIsModalOpen(true);
    try {
      const [fRes, pRes] = await Promise.all([
        api.get('/flights?limit=50'),
        api.get('/passengers?limit=50')
      ]);
      setFlights(fRes.data);
      setPassengers(pRes.data);
      if (fRes.data.length > 0) {
        setSelectedFlightId(fRes.data[0].flight_id);
        loadSeats(fRes.data[0].flight_id);
      }
      if (pRes.data.length > 0) {
        setSelectedPassengerId(pRes.data[0].passenger_id);
      }
    } catch (err) {
      setModalError('Failed to load initial data');
    }
  };

  const loadSeats = async (flightId) => {
    try {
      const res = await api.get(`/flights/${flightId}/available-seats`);
      setAvailableSeats(res.data);
      setSelectedSeatIds([]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFlightChange = (fid) => {
    setSelectedFlightId(fid);
    loadSeats(fid);
  };

  const toggleSeatSelection = (seatId) => {
    setSelectedSeatIds((prev) =>
      prev.includes(seatId) ? prev.filter((id) => id !== seatId) : [...prev, seatId]
    );
  };

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    if (selectedSeatIds.length === 0) {
      setModalError('Please select at least one available seat');
      return;
    }
    setBookingLoading(true);
    setModalError('');

    try {
      await api.post('/bookings', {
        passenger_id: parseInt(selectedPassengerId),
        flight_id: parseInt(selectedFlightId),
        seat_ids: selectedSeatIds,
        payment_method: paymentMethod,
        simulate_fail: simulateFail,
        metadata: { booking_channel: "WEB_PORTAL" }
      });
      setIsModalOpen(false);
      fetchBookings();
    } catch (err) {
      setModalError(err.response?.data?.detail || 'Booking creation rejected');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!cancelBookingId) return;
    setCancelLoading(true);
    try {
      await api.post(`/bookings/${cancelBookingId}/cancel`, { reason: cancelReason });
      setCancelBookingId(null);
      fetchBookings();
    } catch (err) {
      alert(err.response?.data?.detail || 'Cancellation failed');
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Passenger Bookings & Ticketing</h1>
          <p className="text-xs text-slate-500 mt-1">
            Transactional booking lifecycle: Held &rarr; Simulated Payment &rarr; Confirmed / Cancelled.
          </p>
        </div>
        <button
          onClick={openNewBookingModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Reservation</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-4 rounded-xl border border-slate-200/80">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchBookings()}
              placeholder="Search reference (e.g. AF-)..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <button
            onClick={fetchBookings}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition"
          >
            Search
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-slate-500">Status:</span>
          {['', 'CONFIRMED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-surface rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-6">Reference</th>
                <th className="py-3 px-6">Passenger</th>
                <th className="py-3 px-6">Flight</th>
                <th className="py-3 px-6 text-right">Fare Amount</th>
                <th className="py-3 px-6 text-center">Status</th>
                <th className="py-3 px-6">Channel</th>
                <th className="py-3 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {bookings.map((b) => (
                <tr key={b.booking_id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-6 font-bold text-slate-900">{b.booking_reference}</td>
                  <td className="py-3.5 px-6 font-medium">{b.passenger_name || `Passenger #${b.passenger_id}`}</td>
                  <td className="py-3.5 px-6 font-semibold text-blue-600">{b.flight_number}</td>
                  <td className="py-3.5 px-6 text-right font-extrabold text-slate-900">
                    ₹{Number(b.total_amount).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-6 text-center">
                    {b.booking_status === 'CONFIRMED' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-green-50 text-green-700">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700">
                        <XCircle className="w-3.5 h-3.5" /> Cancelled
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-6 text-slate-400">
                    {b.booking_metadata?.booking_channel || 'DIRECT'}
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    {b.booking_status === 'CONFIRMED' && (
                      <button
                        onClick={() => setCancelBookingId(b.booking_id)}
                        className="px-2.5 py-1 text-red-600 hover:bg-red-50 rounded-md font-semibold transition"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Reservation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">New Flight Reservation</h3>
                <p className="text-xs text-slate-400">Database transactional booking procedure with seat lock</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateBooking} className="p-6 overflow-y-auto space-y-5 text-xs">
              {modalError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select Passenger</label>
                  <select
                    value={selectedPassengerId}
                    onChange={(e) => setSelectedPassengerId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  >
                    {passengers.map((p) => (
                      <option key={p.passenger_id} value={p.passenger_id}>
                        {p.full_name} ({p.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select Flight</label>
                  <select
                    value={selectedFlightId}
                    onChange={(e) => handleFlightChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  >
                    {flights.map((f) => (
                      <option key={f.flight_id} value={f.flight_id}>
                        {f.flight_number} ({f.origin_code} → {f.destination_code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Visual Seat Map Selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-semibold text-slate-700">Choose Available Seats ({availableSeats.length} available)</label>
                  <span className="text-primary font-bold">{selectedSeatIds.length} Selected</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 max-h-48 overflow-y-auto grid grid-cols-6 sm:grid-cols-8 gap-2">
                  {availableSeats.map((s) => {
                    const isSelected = selectedSeatIds.includes(s.flight_seat_id);
                    return (
                      <button
                        type="button"
                        key={s.flight_seat_id}
                        onClick={() => toggleSeatSelection(s.flight_seat_id)}
                        className={`p-2 rounded-lg font-bold text-[11px] border transition flex flex-col items-center justify-center ${
                          isSelected
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400'
                        }`}
                      >
                        <Armchair className="w-3.5 h-3.5 mb-1" />
                        <span>{s.seat_number}</span>
                        <span className="text-[9px] font-normal opacity-80">{s.seat_class[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payment Settings */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Method (Simulated)</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  >
                    <option value="UPI">UPI</option>
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="NET_BANKING">Net Banking</option>
                    <option value="DEBIT_CARD">Debit Card</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={simulateFail}
                      onChange={(e) => setSimulateFail(e.target.checked)}
                      className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
                    />
                    <span className="text-slate-700 font-medium">Simulate Payment Failure (Test Rollback)</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookingLoading}
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-blue-700 text-white font-semibold transition"
                >
                  {bookingLoading ? "Executing Procedure..." : "Process Booking (sp_process_booking)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {cancelBookingId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Confirm Booking Cancellation</h3>
            <p className="text-xs text-slate-500">
              This triggers <code>sp_process_cancellation</code> in MySQL, calculating tiered refund based on hours before departure and releasing reserved seats.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cancellation Reason</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCancelBookingId(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium"
              >
                Keep Booking
              </button>
              <button
                type="button"
                onClick={handleCancelBooking}
                disabled={cancelLoading}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition"
              >
                {cancelLoading ? "Processing..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

