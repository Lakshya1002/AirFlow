import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Users, Plus, Search, Mail, Phone, Calendar } from 'lucide-react';

export default function Passengers() {
  const [passengers, setPassengers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // New passenger modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchPassengers = () => {
    setLoading(true);
    let url = '/passengers?limit=100';
    if (search) url += `&search=${search}`;
    api.get(url)
      .then((res) => setPassengers(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPassengers();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/passengers', {
        full_name: fullName,
        email: email,
        phone: phone
      });
      setIsModalOpen(false);
      setFullName('');
      setEmail('');
      setPhone('');
      fetchPassengers();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add passenger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Passenger Directory</h1>
          <p className="text-xs text-slate-500 mt-1">Verified traveler identities and contact profiles.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Passenger</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-surface p-4 rounded-xl border border-slate-200/80 max-w-md">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchPassengers()}
            placeholder="Search passenger name or email..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-6">ID</th>
                <th className="py-3 px-6">Full Name</th>
                <th className="py-3 px-6">Email Address</th>
                <th className="py-3 px-6">Phone</th>
                <th className="py-3 px-6">Registered Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {passengers.map((p) => (
                <tr key={p.passenger_id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-6 font-bold text-slate-400">#{p.passenger_id}</td>
                  <td className="py-3.5 px-6 font-bold text-slate-900">{p.full_name}</td>
                  <td className="py-3.5 px-6 text-slate-600">{p.email}</td>
                  <td className="py-3.5 px-6 text-slate-500">{p.phone || '—'}</td>
                  <td className="py-3.5 px-6 text-slate-400">
                    {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Passenger Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Register Passenger</h3>
            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">{error}</div>
            )}
            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. aarav.sharma@gmail.com"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91-9876543210"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
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
                  {saving ? "Registering..." : "Save Passenger"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

