import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { DollarSign, Plus, Edit2, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Fares() {
  const [fares, setFares] = useState([]);
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const { role } = useAuth();

  // New fare modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [flightId, setFlightId] = useState('');
  const [fareClass, setFareClass] = useState('ECONOMY');
  const [baseFare, setBaseFare] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Edit Fare modal
  const [editingFare, setEditingFare] = useState(null);
  const [editFareAmount, setEditFareAmount] = useState('');

  const fetchFares = () => {
    setLoading(true);
    api.get('/fares?limit=100')
      .then((res) => setFares(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFares();
    api.get('/flights?limit=50').then((res) => {
      setFlights(res.data);
      if (res.data.length > 0) setFlightId(res.data[0].flight_id);
    });
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/fares', {
        flight_id: parseInt(flightId),
        fare_class: fareClass,
        base_fare: parseFloat(baseFare),
        valid_from: validFrom,
        valid_until: validUntil || null
      });
      setIsModalOpen(false);
      setBaseFare('');
      fetchFares();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save fare schedule');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingFare) return;
    try {
      await api.put(`/fares/${editingFare.fare_id}`, {
        base_fare: parseFloat(editFareAmount)
      });
      setEditingFare(null);
      fetchFares();
    } catch (err) {
      alert(err.response?.data?.detail || 'Update failed');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Fare Schedule & Dynamic Class Pricing</h1>
          <p className="text-xs text-slate-500 mt-1">
            Historical pricing records with validity periods and database-enforced non-overlap integrity.
          </p>
        </div>
        {role === 'ADMIN' && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Class Fare</span>
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-surface rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-6">Fare ID</th>
                <th className="py-3 px-6">Flight ID</th>
                <th className="py-3 px-6">Class</th>
                <th className="py-3 px-6 text-right font-bold text-slate-700">Base Fare</th>
                <th className="py-3 px-6">Valid From</th>
                <th className="py-3 px-6">Valid Until</th>
                {role === 'ADMIN' && <th className="py-3 px-6 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {fares.map((f) => (
                <tr key={f.fare_id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-6 font-bold text-slate-400">#{f.fare_id}</td>
                  <td className="py-3.5 px-6 font-bold text-blue-600">Flight #{f.flight_id}</td>
                  <td className="py-3.5 px-6 font-semibold">{f.fare_class}</td>
                  <td className="py-3.5 px-6 text-right font-extrabold text-slate-900">
                    ₹{Number(f.base_fare).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-6 text-slate-500">{f.valid_from}</td>
                  <td className="py-3.5 px-6 text-slate-400">{f.valid_until || 'Open-ended'}</td>
                  {role === 'ADMIN' && (
                    <td className="py-3.5 px-6 text-right">
                      <button
                        onClick={() => {
                          setEditingFare(f);
                          setEditFareAmount(f.base_fare);
                        }}
                        className="px-2.5 py-1 text-slate-600 hover:text-primary hover:bg-slate-100 rounded-md font-semibold transition"
                      >
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Fare Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">New Class Fare Schedule</h3>
            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">{error}</div>
            )}
            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Flight</label>
                <select
                  value={flightId}
                  onChange={(e) => setFlightId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                >
                  {flights.map((fl) => (
                    <option key={fl.flight_id} value={fl.flight_id}>
                      {fl.flight_number} ({fl.origin_code} &rarr; {fl.destination_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fare Class</label>
                  <select
                    value={fareClass}
                    onChange={(e) => setFareClass(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  >
                    <option value="ECONOMY">Economy</option>
                    <option value="BUSINESS">Business</option>
                    <option value="FIRST">First Class</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Base Fare (₹)</label>
                  <input
                    type="number"
                    required
                    min="500"
                    value={baseFare}
                    onChange={(e) => setBaseFare(e.target.value)}
                    placeholder="e.g. 5200"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valid From</label>
                  <input
                    type="date"
                    required
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valid Until (Optional)</label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-blue-700 text-white font-semibold transition"
                >
                  {saving ? "Validating & Saving..." : "Save Fare"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Fare Modal */}
      {editingFare && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface w-full max-w-sm rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Update Base Fare</h3>
            <form onSubmit={handleUpdate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  New Base Fare for {editingFare.fare_class} (₹)
                </label>
                <input
                  type="number"
                  required
                  min="500"
                  value={editFareAmount}
                  onChange={(e) => setEditFareAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingFare(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary text-white font-semibold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

