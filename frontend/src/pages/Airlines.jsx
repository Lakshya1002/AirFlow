import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Building2, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Airlines() {
  const [airlines, setAirlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const { role } = useAuth();

  // Create modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [country, setCountry] = useState('India');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchAirlines = () => {
    setLoading(true);
    api.get('/airlines')
      .then((res) => setAirlines(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAirlines();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/airlines', {
        airline_name: name,
        airline_code: code.toUpperCase(),
        country: country
      });
      setIsModalOpen(false);
      setName('');
      setCode('');
      fetchAirlines();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add airline');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this airline? Note: deletion will be rejected by database foreign keys if flights or aircraft depend on it.")) return;
    try {
      await api.delete(`/airlines/${id}`);
      fetchAirlines();
    } catch (err) {
      alert(err.response?.data?.detail || 'Cannot delete airline with dependent records');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Airline Carriers</h1>
          <p className="text-xs text-slate-500 mt-1">Operating carriers with registered IATA codes.</p>
        </div>
        {role === 'ADMIN' && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Airline</span>
          </button>
        )}
      </div>

      <div className="bg-surface rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-6">ID</th>
                <th className="py-3 px-6">Airline Name</th>
                <th className="py-3 px-6">Code</th>
                <th className="py-3 px-6">Country</th>
                {role === 'ADMIN' && <th className="py-3 px-6 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {airlines.map((a) => (
                <tr key={a.airline_id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-6 font-bold text-slate-400">#{a.airline_id}</td>
                  <td className="py-3.5 px-6 font-bold text-slate-900">{a.airline_name}</td>
                  <td className="py-3.5 px-6 font-mono font-bold text-primary">{a.airline_code}</td>
                  <td className="py-3.5 px-6 text-slate-500">{a.country}</td>
                  {role === 'ADMIN' && (
                    <td className="py-3.5 px-6 text-right">
                      <button
                        onClick={() => handleDelete(a.airline_id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition"
                        title="Delete airline"
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
            <h3 className="font-bold text-slate-900 text-base">Add Airline Carrier</h3>
            {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">{error}</div>}
            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Airline Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Vistara"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Carrier Code (2-5 chars)</label>
                <input
                  type="text"
                  required
                  maxLength={5}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. UK"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 uppercase"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Country</label>
                <input
                  type="text"
                  required
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
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
                  {saving ? "Saving..." : "Add Airline"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
