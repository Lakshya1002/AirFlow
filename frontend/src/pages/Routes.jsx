import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { GitCommit, Plus, Trash2, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Routes() {
  const [routes, setRoutes] = useState([]);
  const [airports, setAirports] = useState([]);
  const [loading, setLoading] = useState(true);
  const { role } = useAuth();

  // Create modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [origId, setOrigId] = useState('');
  const [destId, setDestId] = useState('');
  const [distance, setDistance] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchRoutes = () => {
    setLoading(true);
    api.get('/routes?limit=100')
      .then((res) => setRoutes(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRoutes();
    api.get('/airports').then((res) => {
      setAirports(res.data);
      if (res.data.length >= 2) {
        setOrigId(res.data[0].airport_id);
        setDestId(res.data[1].airport_id);
      }
    });
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (origId === destId) {
      setError("Origin and Destination cannot be the same airport");
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/routes', {
        origin_airport_id: parseInt(origId),
        destination_airport_id: parseInt(destId),
        distance_km: parseFloat(distance)
      });
      setIsModalOpen(false);
      setDistance('');
      fetchRoutes();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add route');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this route? Note: deletion will be rejected if flights are scheduled.")) return;
    try {
      await api.delete(`/routes/${id}`);
      fetchRoutes();
    } catch (err) {
      alert(err.response?.data?.detail || 'Cannot delete route with scheduled flights');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Flight Routes & Corridors</h1>
          <p className="text-xs text-slate-500 mt-1">Origin-destination terminal pairings with geodesic distance tracking.</p>
        </div>
        {role === 'ADMIN' && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Route</span>
          </button>
        )}
      </div>

      <div className="bg-surface rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-6">Route ID</th>
                <th className="py-3 px-6">Origin</th>
                <th className="py-3 px-6">Destination</th>
                <th className="py-3 px-6 text-right font-bold text-slate-700">Distance</th>
                {role === 'ADMIN' && <th className="py-3 px-6 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {routes.map((r) => (
                <tr key={r.route_id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-6 font-bold text-slate-400">#{r.route_id}</td>
                  <td className="py-3.5 px-6">
                    <span className="font-bold text-slate-900">{r.origin_code}</span>
                    <span className="text-slate-400 text-[11px] ml-1.5">({r.origin_city})</span>
                  </td>
                  <td className="py-3.5 px-6">
                    <span className="font-bold text-slate-900">{r.destination_code}</span>
                    <span className="text-slate-400 text-[11px] ml-1.5">({r.destination_city})</span>
                  </td>
                  <td className="py-3.5 px-6 text-right font-extrabold text-blue-600">
                    {r.distance_km} km
                  </td>
                  {role === 'ADMIN' && (
                    <td className="py-3.5 px-6 text-right">
                      <button
                        onClick={() => handleDelete(r.route_id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition"
                        title="Delete route"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface w-full max-w-sm rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">New Flight Route Corridor</h3>
            {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">{error}</div>}
            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Origin Terminal</label>
                <select
                  value={origId}
                  onChange={(e) => setOrigId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                >
                  {airports.map((a) => (
                    <option key={a.airport_id} value={a.airport_id}>{a.airport_code} - {a.city}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Destination Terminal</label>
                <select
                  value={destId}
                  onChange={(e) => setDestId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                >
                  {airports.map((a) => (
                    <option key={a.airport_id} value={a.airport_id}>{a.airport_code} - {a.city}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Geodesic Distance (km)</label>
                <input
                  type="number"
                  required
                  min="50"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  placeholder="e.g. 1420"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-primary text-white font-semibold"
                >
                  {saving ? "Creating..." : "Save Route"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

