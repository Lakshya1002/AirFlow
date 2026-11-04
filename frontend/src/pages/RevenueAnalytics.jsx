import React, { useState, useEffect } from 'react';
import api from '../services/api';
import SqlViewer from '../components/SqlViewer';
import { Database, TrendingUp, Award, Layers, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function RevenueAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSql, setActiveSql] = useState(null);

  useEffect(() => {
    api.get('/analytics/revenue')
      .then((res) => setData(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-medium">Computing revenue window functions and growth models...</p>
      </div>
    );
  }

  const { monthly, running_totals, ranked_flights, sql } = data || {};

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Revenue Analytics & Growth Intelligence</h1>
          <p className="text-xs text-slate-500 mt-1">
            Advanced SQL: Window Functions (<code>LAG</code>, <code>LEAD</code>, <code>SUM() OVER</code>, <code>ROW_NUMBER()</code>, <code>RANK()</code>).
          </p>
        </div>
        <button
          onClick={() => setActiveSql({
            title: "Advanced SQL Revenue Queries (Window Functions & CTEs)",
            query: Object.entries(sql || {}).map(([k, v]) => `-- [${k.toUpperCase()}]\n${v}\n`).join('\n')
          })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition"
        >
          <Database className="w-4 h-4 text-blue-400" />
          <span>SQL Behind This</span>
        </button>
      </div>

      {/* MoM Growth Table with LAG() */}
      <div className="bg-surface rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Month-Over-Month (MoM) Growth Analysis</h3>
            <p className="text-xs text-slate-400">Calculated in SQL view <code>vw_monthly_revenue</code> using <code>LAG(net_revenue) OVER (ORDER BY revenue_month)</code></p>
          </div>
          <button
            onClick={() => setActiveSql({ title: "Month-Over-Month SQL (LAG Function)", query: sql?.monthly })}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            <Database className="w-3.5 h-3.5" /> View SQL
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-6">Month</th>
                <th className="py-3 px-6 text-right">Gross Revenue (₹)</th>
                <th className="py-3 px-6 text-right">Refunds (₹)</th>
                <th className="py-3 px-6 text-right font-bold text-slate-700">Net Revenue (₹)</th>
                <th className="py-3 px-6 text-right">Prev Month Net (₹)</th>
                <th className="py-3 px-6 text-center">MoM Growth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {monthly?.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-6 font-semibold">{row.revenue_month}</td>
                  <td className="py-3.5 px-6 text-right">₹{Number(row.gross_revenue).toLocaleString()}</td>
                  <td className="py-3.5 px-6 text-right text-red-600">₹{Number(row.total_refunds).toLocaleString()}</td>
                  <td className="py-3.5 px-6 text-right font-bold text-blue-600">₹{Number(row.net_revenue).toLocaleString()}</td>
                  <td className="py-3.5 px-6 text-right text-slate-400">
                    {row.prev_month_net ? `₹${Number(row.prev_month_net).toLocaleString()}` : '—'}
                  </td>
                  <td className="py-3.5 px-6 text-center">
                    {row.mom_growth_pct === null ? (
                      <span className="text-slate-400 font-medium">— (Baseline)</span>
                    ) : row.mom_growth_pct > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-50 text-green-700">
                        <ArrowUpRight className="w-3.5 h-3.5" /> +{row.mom_growth_pct}%
                      </span>
                    ) : row.mom_growth_pct < 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700">
                        <ArrowDownRight className="w-3.5 h-3.5" /> {row.mom_growth_pct}%
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                        <Minus className="w-3.5 h-3.5" /> 0.00%
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row: Cumulative Revenue (Running Total) & Top/Bottom Flights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cumulative Revenue Chart */}
        <div className="bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Cumulative Running Net Revenue</h3>
              <p className="text-xs text-slate-400">Calculated via <code>SUM(net_revenue) OVER (ORDER BY month)</code></p>
            </div>
            <button
              onClick={() => setActiveSql({ title: "Cumulative Window Function SQL", query: sql?.running_totals })}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <Database className="w-3.5 h-3.5" /> View SQL
            </button>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={running_totals}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="revenue_month" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickFormatter={(val) => `₹${(val / 10000000).toFixed(1)}Cr`}
                />
                <Tooltip
                  formatter={(val) => [`₹${Number(val).toLocaleString()}`, 'Cumulative Revenue']}
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Line type="monotone" dataKey="cumulative_revenue" stroke="#16A34A" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top 5 and Bottom 5 Flights by Net Revenue (Window Function) */}
        <div className="bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Top & Bottom Revenue Flights</h3>
              <p className="text-xs text-slate-400">Identified via <code>ROW_NUMBER() OVER (ORDER BY net_revenue)</code></p>
            </div>
            <button
              onClick={() => setActiveSql({ title: "Top & Bottom Window Function SQL", query: sql?.ranked_flights })}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <Database className="w-3.5 h-3.5" /> View SQL
            </button>
          </div>
          <div className="space-y-2.5 overflow-y-auto max-h-64 pr-1">
            {ranked_flights?.map((flight, i) => (
              <div
                key={i}
                className={`flex items-center justify-between p-2.5 rounded-xl border ${
                  flight.category?.includes('Top')
                    ? 'bg-blue-50/40 border-blue-100'
                    : 'bg-red-50/40 border-red-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                    flight.category?.includes('Top') ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {flight.category}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-slate-800">{flight.flight_number} &bull; {flight.airline_name}</div>
                    <div className="text-[10px] text-slate-400">{flight.route}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-extrabold text-slate-900">₹{Number(flight.net_revenue).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {activeSql && (
        <SqlViewer
          title={activeSql.title}
          sqlQuery={activeSql.query}
          onClose={() => setActiveSql(null)}
        />
      )}
    </div>
  );
}

