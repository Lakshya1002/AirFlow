import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { CreditCard, CheckCircle, XCircle, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchPayments = () => {
    setLoading(true);
    let url = '/payments?limit=100';
    if (typeFilter) url += `&payment_type=${typeFilter}`;
    if (statusFilter) url += `&payment_status=${statusFilter}`;
    api.get(url)
      .then((res) => setPayments(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPayments();
  }, [typeFilter, statusFilter]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payment & Refund Ledger</h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete transaction journal distinguishing gross incoming payments from outgoing policy refunds.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-surface p-4 rounded-xl border border-slate-200/80 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-500">Transaction Type:</span>
          {['', 'PAYMENT', 'REFUND'].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                typeFilter === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t || 'All'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-500">Status:</span>
          {['', 'SUCCESS', 'FAILED'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                statusFilter === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-6">Txn Reference</th>
                <th className="py-3 px-6">Booking ID</th>
                <th className="py-3 px-6">Method</th>
                <th className="py-3 px-6">Type</th>
                <th className="py-3 px-6 text-right font-bold text-slate-700">Amount</th>
                <th className="py-3 px-6 text-center">Status</th>
                <th className="py-3 px-6">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {payments.map((p) => (
                <tr key={p.payment_id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-6 font-mono font-bold text-slate-900">{p.transaction_reference}</td>
                  <td className="py-3.5 px-6 font-medium text-slate-600">Booking #{p.booking_id}</td>
                  <td className="py-3.5 px-6 text-slate-500">{p.payment_method || 'CARD'}</td>
                  <td className="py-3.5 px-6">
                    {p.payment_type === 'PAYMENT' ? (
                      <span className="inline-flex items-center gap-1 font-bold text-blue-600">
                        <ArrowDownLeft className="w-3.5 h-3.5" /> Payment
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-600">
                        <ArrowUpRight className="w-3.5 h-3.5" /> Refund
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-6 text-right font-extrabold text-slate-900">
                    {p.payment_type === 'REFUND' ? '-' : '+'}₹{Number(p.amount).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-6 text-center">
                    {p.payment_status === 'SUCCESS' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700">
                        <CheckCircle className="w-3 h-3" /> Success
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700">
                        <XCircle className="w-3 h-3" /> Failed
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-6 text-slate-400">
                    {new Date(p.payment_date).toLocaleString()}
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

