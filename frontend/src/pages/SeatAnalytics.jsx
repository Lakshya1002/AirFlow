import React, { useState, useEffect } from 'react';
import api from '../services/api';
import SqlViewer from '../components/SqlViewer';
import { Database, Armchair, ShieldAlert, CheckCircle, PieChart as PieIcon } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

export default function SeatAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSql, setActiveSql] = useState(null);

  useEffect(() => {
    api.get('/analytics/occupancy')
      .then((res) => setData(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-medium">Querying seat inventory metrics from MySQL view vw_seat_occupancy...</p>
      </div>
    );
  }

  const { summary, distribution, airline_occupancy, top_flights, sql } = data || {};

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Seat Utilization & Inventory Intelligence</h1>
          <p className="text-xs text-slate-500 mt-1">
            Precise load factor calculation: <code>Occupancy % = Confirmed Occupied / (Total − Blocked) × 100</code>.
          </p>
        </div>
        <button
          onClick={() => setActiveSql({
            title: "Seat Occupancy Logic (vw_seat_occupancy & CTEs)",
            query: Object.entries(sql || {}).map(([k, v]) => `-- [${k.toUpperCase()}]\n${v}\n`).join('\n')
          })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition"
        >
          <Database className="w-4 h-4 text-blue-400" />
          <span>SQL Behind This</span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-surface p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 mb-1">Average Occupancy</div>
          <div className="text-2xl font-black text-primary">{summary?.avg_occupancy}%</div>
          <div className="text-[11px] text-slate-400 mt-1">Excludes Blocked Seats</div>
        </div>

        <div className="bg-surface p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 mb-1">Total Physical Seats</div>
          <div className="text-2xl font-black text-slate-800">{Number(summary?.total_capacity || 0).toLocaleString()}</div>
          <div className="text-[11px] text-slate-400 mt-1">Across 400 Flights</div>
        </div>

        <div className="bg-surface p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 mb-1">Sellable Inventory</div>
          <div className="text-2xl font-black text-slate-800">{Number(summary?.total_sellable || 0).toLocaleString()}</div>
          <div className="text-[11px] text-slate-400 mt-1">Capacity − Blocked</div>
        </div>

        <div className="bg-surface p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 mb-1">Confirmed Occupied</div>
          <div className="text-2xl font-black text-emerald-600">{Number(summary?.total_occupied || 0).toLocaleString()}</div>
          <div className="text-[11px] text-slate-400 mt-1">Paid / Confirmed Assignments</div>
        </div>

        <div className="bg-surface p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 mb-1">Blocked / Inactive</div>
          <div className="text-2xl font-black text-amber-600">{Number(summary?.total_blocked || 0).toLocaleString()}</div>
          <div className="text-[11px] text-slate-400 mt-1">Maintenance / Crew holds</div>
        </div>
      </div>

      {/* Row: Airline Occupancy Bar Chart & Top Flights Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Occupancy by Airline */}
        <div className="bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Average Seat Occupancy by Carrier</h3>
              <p className="text-xs text-slate-400">Aggregated via vw_seat_occupancy</p>
            </div>
            <button
              onClick={() => setActiveSql({ title: "Carrier Occupancy SQL", query: sql?.airline_occupancy })}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <Database className="w-3.5 h-3.5" /> View SQL
            </button>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={airline_occupancy}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="airline_name" tick={{ fontSize: 10, fill: '#64748B' }} angle={-25} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(val) => `${val}%`} />
                <Tooltip
                  formatter={(val) => [`${val}%`, 'Occupancy Rate']}
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="avg_occupancy" fill="#2563EB" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Highest Occupancy Flights Table */}
        <div className="bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Highest Occupancy Flights</h3>
              <p className="text-xs text-slate-400">Top flights exceeding load targets</p>
            </div>
            <button
              onClick={() => setActiveSql({ title: "Top Occupancy Flights SQL", query: sql?.top_flights })}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <Database className="w-3.5 h-3.5" /> View SQL
            </button>
          </div>
          <div className="space-y-3 overflow-y-auto max-h-72 pr-1">
            {top_flights?.map((flight, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <div className="text-xs font-bold text-slate-800">{flight.flight_number} &bull; {flight.airline_name}</div>
                  <div className="text-[10px] text-slate-400">{flight.route} &bull; {flight.confirmed_occupied} / {flight.sellable_seats} seats</div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700">
                    {flight.occupancy_pct}%
                  </span>
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
