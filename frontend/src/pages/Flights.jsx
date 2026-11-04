import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { CalendarDays, Plus, Filter, Plane, ArrowRight, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Flights() {
  const [flights, setFlights] = useState([]);
  const [airlines, setAirlines] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [aircraft, setAircraft] = useState([]);
  const [loading, setLoading] = useState(true);
  const { role } = useAuth();

  // Create modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [airlineId, setAirlineId] = useState('');
  const [aircraftId, setAircraftId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [flightNumber, setFlightNumber] = useState('');
  const [depTime, setDepTime] = useState('');
  const [arrTime, setArrTime] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  const fetchFlights = () => {
    setLoading(true);
    api.get('/flights?limit=100')
      .then((res) => setFlights(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFlights();
  }, []);

  const openCreateModal = async () => {
    setCreateError('');
    setIsModalOpen(true);
    try {
      const [alRes, rRes, acRes] = await Promise.all([
        api.get('/airlines?limit=50'),
        api.get('/routes?limit=100'),
        api.get('/aircraft?limit=50')
      ]);
      setAirlines(alRes.data);
      setRoutes(rRes.data);
      setAircraft(acRes.data);
      if (alRes.data.length > 0) setAirlineId(alRes.data[0].airline_id);
      if (rRes.data.length > 0) setRouteId(rRes.data[0].route_id);
      if (acRes.data.length > 0) setAircraftId(acRes.data[0].aircraft_id);
    } catch (err) {
      setCreateError('Failed to load master metadata');
    }
  };

  const handleCreateFlight = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError('');
    try {
      await api.post('/flights', {
        airline_id: parseInt(airlineId),
        aircraft_id: parseInt(aircraftId),
        route_id: parseInt(routeId),
        flight_number: flightNumber.toUpperCase(),
        departure_time: depTime,
        arrival_time: arrTime,
        flight_status: 'SCHEDULED'
      });
      setIsModalOpen(false);
      fetchFlights();
    } catch (err) {
      setCreateError(err.response?.data?.detail || 'Failed to create flight');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleStatusChange = async (flightId, newStatus) => {
    try {
      await api.patch(`/flights/${flightId}/status`, { flight_status: newStatus });
      fetchFlights();
    } catch (err) {
      alert(err.response?.data?.detail || 'Invalid status transition rejected by database trigger');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Flight Operations & Inventory Creation</h1>
          <p className="text-xs text-slate-500 mt-1">
            Creating a flight invokes stored procedure <code>sp_create_flight_seats</code> to auto-generate individual seat inventory.
          </p>
        </div>
        {role === 'ADMIN' && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule New Flight</span>
          </button>
        )}
      </div>

      {/* Flight Table */}
      <div className="bg-surface rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-6">Flight No.</th>
                <th className="py-3 px-6">Airline</th>
                <th className="py-3 px-6">Corridor</th>
                <th className="py-3 px-6">Departure</th>
                <th className="py-3 px-6">Arrival</th>
                <th className="py-3 px-6 text-center">Status</th>
                {role === 'ADMIN' && <th className="py-3 px-6 text-right">Update Status</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {flights.map((f) => (
                <tr key={f.flight_id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-6 font-bold text-slate-900">{f.flight_number}</td>
                  <td className="py-3.5 px-6 font-semibold text-primary">{f.airline_name}</td>
                  <td className="py-3.5 px-6">
                    <span className="font-bold text-slate-800">{f.origin_code}</span>
                    <span className="text-slate-400 mx-1.5">&rarr;</span>
                    <span className="font-bold text-slate-800">{f.destination_code}</span>
                  </td>
                  <td className="py-3.5 px-6 text-slate-500">{new Date(f.departure_time).toLocaleString()}</td>
                  <td className="py-3.5 px-6 text-slate-500">{new Date(f.arrival_time).toLocaleString()}</td>
                  <td className="py-3.5 px-6 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      f.flight_status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' :
                      f.flight_status === 'SCHEDULED' ? 'bg-blue-50 text-blue-700' :
                      f.flight_status === 'BOARDING' ? 'bg-amber-50 text-amber-700' :
                      'bg-red-50 text-red-700'
                    }`}>
                      {f.flight_status}
                    </span>
                  </td>
                  {role === 'ADMIN' && (
                    <td className="py-3.5 px-6 text-right">
                      {f.flight_status === 'SCHEDULED' && (
                        <button
                          onClick={() => handleStatusChange(f.flight_id, 'BOARDING')}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-[10px] font-bold mr-1.5 transition"
                        >
                          Boarding
                        </button>
                      )}
                      {f.flight_status === 'BOARDING' && (
                        <button
                          onClick={() => handleStatusChange(f.flight_id, 'COMPLETED')}
                          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold transition"
                        >
                          Complete
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Flight Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Schedule New Flight</h3>
            <p className="text-xs text-slate-500">
              Initializing flight will execute <code>sp_create_flight_seats</code> to copy aircraft seat rows into <code>flight_seats</code>.
            </p>

            {createError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateFlight} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Airline Carrier</label>
                  <select
                    value={airlineId}
                    onChange={(e) => setAirlineId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  >
                    {airlines.map((a) => (
                      <option key={a.airline_id} value={a.airline_id}>{a.airline_name} ({a.airline_code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Aircraft</label>
                  <select
                    value={aircraftId}
                    onChange={(e) => setAircraftId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  >
                    {aircraft.map((ac) => (
                      <option key={ac.aircraft_id} value={ac.aircraft_id}>{ac.model} ({ac.registration_number})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Route Corridor</label>
                <select
                  value={routeId}
                  onChange={(e) => setRouteId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                >
                  {routes.map((r) => (
                    <option key={r.route_id} value={r.route_id}>
                      {r.origin_code} &rarr; {r.destination_code} ({r.distance_km} km)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Flight Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 6E-902"
                  value={flightNumber}
                  onChange={(e) => setFlightNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Departure Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={depTime}
                    onChange={(e) => setDepTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Arrival Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={arrTime}
                    onChange={(e) => setArrTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-blue-700 text-white font-semibold transition"
                >
                  {createLoading ? "Creating Inventory..." : "Create Flight"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

