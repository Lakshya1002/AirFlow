import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plane, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Aircraft() {
  const [aircraftList, setAircraftList] = useState([]);
  const [airlines, setAirlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const { role } = useAuth();

  // Create modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [airlineId, setAirlineId] = useState('');
  const [regNo, setRegNo] = useState('');
  const [model, setModel] = useState('Airbus A320neo');
  const [economy, setEconomy] = useState(150);
  const [business, setBusiness] = useState(12);
  const [first, setFirst] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchAircraft = () => {
    setLoading(true);
    api.get('/aircraft')
      .then((res) => setAircraftList(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAircraft();
    api.get('/airlines').then((res) => {
      setAirlines(res.data);
      if (res.data.length > 0) setAirlineId(res.data[0].airline_id);
    });
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/aircraft', {
        airline_id: parseInt(airlineId),
        registration_number: regNo.toUpperCase(),
        model: model,
        layout: {
          economy_seats: parseInt(economy),
          business_seats: parseInt(business),
          first_seats: parseInt(first)
        }
      });
      setIsModalOpen(false);
      setRegNo('');
      fetchAircraft();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add aircraft');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this aircraft? Deleting will remove permanent seat layout.")) return;
    try {
      await api.delete(`/aircraft/${id}`);
      fetchAircraft();
    } catch (err) {
      alert(err.response?.data?.detail || 'Cannot delete aircraft assigned to scheduled flights');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Aircraft Fleet & Physical Seat Layouts</h1>
          <p className="text-xs text-slate-500 mt-1">Permanent cabin configurations across commercial carriers.</p>
        </div>
        {role === 'ADMIN' && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Aircraft</span>
          </button>
        )}
      </div>

      <div className="bg-surface rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-6">ID</th>
                <th className="py-3 px-6">Registration</th>
                <th className="py-3 px-6">Model</th>
                <th className="py-3 px-6">Carrier ID</th>
                <th className="py-3 px-6 text-right font-bold text-slate-700">Total Capacity</th>
                {role === 'ADMIN' && <th className="py-3 px-6 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {aircraftList.map((ac) => (
                <tr key={ac.aircraft_id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-6 font-bold text-slate-400">#{ac.aircraft_id}</td>
                  <td className="py-3.5 px-6 font-mono font-bold text-primary">{ac.registration_number}</td>
                  <td className="py-3.5 px-6 font-medium text-slate-800">{ac.model}</td>
                  <td className="py-3.5 px-6 text-slate-500">Airline #{ac.airline_id}</td>
                  <td className="py-3.5 px-6 text-right font-extrabold text-slate-900">{ac.total_capacity} seats</td>
                  {role === 'ADMIN' && (
                    <td className="py-3.5 px-6 text-right">
                      <button
                        onClick={() => handleDelete(ac.aircraft_id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition"
                        title="Delete aircraft"
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
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Add Aircraft Fleet Member</h3>
            <p className="text-xs text-slate-400">Generates physical layout in <code>aircraft_seats</code> table.</p>
            {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">{error}</div>}
            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Carrier</label>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Registration (VT-XXX)</label>
                  <input
                    type="text"
                    required
                    value={regNo}
                    onChange={(e) => setRegNo(e.target.value)}
                    placeholder="e.g. VT-IND"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Model</label>
                  <input
                    type="text"
                    required
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Economy</label>
                  <input
                    type="number"
                    min="0"
                    value={economy}
                    onChange={(e) => setEconomy(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Business</label>
                  <input
                    type="number"
                    min="0"
                    value={business}
                    onChange={(e) => setBusiness(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">First Class</label>
                  <input
                    type="number"
                    min="0"
                    value={first}
                    onChange={(e) => setFirst(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
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
                  {saving ? "Generating Layout..." : "Add Aircraft"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
