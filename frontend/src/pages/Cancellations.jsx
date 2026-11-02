import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Ban, DollarSign, Calendar, FileText } from 'lucide-react';

export default function Cancellations() {
  const [cancellations, setCancellations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/cancellations?limit=100')
      .then((res) => setCancellations(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Cancellations & Policy Refund Log</h1>
          <p className="text-xs text-slate-500 mt-1">
            Auditable records of released reservations and corresponding calculated refund transactions.
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-6">ID</th>
                <th className="py-3 px-6">Booking Reference ID</th>
                <th className="py-3 px-6">Cancellation Reason</th>
                <th className="py-3 px-6 text-right font-bold text-slate-700">Refund Amount (₹)</th>
                <th className="py-3 px-6">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {cancellations.map((c) => (
                <tr key={c.cancellation_id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-6 font-bold text-slate-400">#{c.cancellation_id}</td>
                  <td className="py-3.5 px-6 font-bold text-slate-900">Booking #{c.booking_id}</td>
                  <td className="py-3.5 px-6 text-slate-600 font-medium">{c.cancellation_reason || 'Personal reasons'}</td>
                  <td className="py-3.5 px-6 text-right font-extrabold text-red-600">
                    ₹{Number(c.refund_amount).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-6 text-slate-400">
                    {new Date(c.cancellation_date).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
