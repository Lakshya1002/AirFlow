import React, { useState, useEffect } from 'react';
import api from '../services/api';
import SqlViewer from '../components/SqlViewer';
import { Database, Route as RouteIcon, ArrowLeftRight, GitCompare } from 'lucide-react';

export default function RouteAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSql, setActiveSql] = useState(null);

  useEffect(() => {
    api.get('/analytics/routes')
      .then((res) => setData(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-medium">Computing route performance views & self-joins...</p>
      </div>
    );
  }

  const { routes, round_trips, sql } = data || {};

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Route Performance & Corridor Analytics</h1>
          <p className="text-xs text-slate-500 mt-1">
            Aggregated via <code>vw_route_performance</code> & Self-Joins identifying return/reverse route pairs.
          </p>
        </div>
        <button
          onClick={() => setActiveSql({
            title: "Route Performance Views & Self-Join SQL",
            query: Object.entries(sql || {}).map(([k, v]) => `-- [${k.toUpperCase()}]\n${v}\n`).join('\n')
          })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition"
        >
          <Database className="w-4 h-4 text-blue-400" />
          <span>SQL Behind This</span>
        </button>
      </div>

      {/* Round-Trip Corridors Identified via SQL SELF JOIN */}
      <div className="bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Bidirectional Round-Trip Pairs (SQL Self-Join)</h3>
              <p className="text-xs text-slate-400">Identified dynamically by joining <code>routes r1 INNER JOIN routes r2 ON r1.origin = r2.destination AND r1.destination = r2.origin</code></p>
            </div>
          </div>
          <button
            onClick={() => setActiveSql({ title: "Self-Join Return Route Pairs SQL", query: sql?.round_trips })}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            <Database className="w-3.5 h-3.5" /> View SQL
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {round_trips?.map((pair, i) => (
            <div key={i} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1">
                <span>{pair.outbound_route}</span>
                <ArrowLeftRight className="w-3.5 h-3.5 text-blue-500" />
                <span>{pair.return_route}</span>
              </div>
              <div className="text-[11px] text-slate-400 font-medium">{pair.distance_km} km Corridor Distance</div>
            </div>
          ))}
        </div>
      </div>

      {/* Master Route Performance Table */}
      <div className="bg-surface rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">All 60 Flight Corridors Performance</h3>
            <p className="text-xs text-slate-400">Revenue, occupancy, bookings, and cancellation rates</p>
          </div>
          <button
            onClick={() => setActiveSql({ title: "Route Performance View SQL", query: sql?.routes })}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            <Database className="w-3.5 h-3.5" /> View SQL
          </button>
        </div>

        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/80 sticky top-0 z-10">
              <tr>
                <th className="py-3 px-6">Rank</th>
                <th className="py-3 px-6">Route</th>
                <th className="py-3 px-6">Corridor</th>
                <th className="py-3 px-6 text-right">Distance</th>
                <th className="py-3 px-6 text-right">Flights</th>
                <th className="py-3 px-6 text-right">Bookings</th>
                <th className="py-3 px-6 text-right font-bold text-slate-700">Net Revenue (₹)</th>
                <th className="py-3 px-6 text-right">Occupancy</th>
                <th className="py-3 px-6 text-right">Cancel Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {routes?.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-6 font-bold text-slate-400">#{r.revenue_rank || i + 1}</td>
                  <td className="py-3.5 px-6 font-bold text-primary">{r.route_label}</td>
                  <td className="py-3.5 px-6 text-slate-500">{r.origin_city} &bull; {r.destination_city}</td>
                  <td className="py-3.5 px-6 text-right">{r.distance_km} km</td>
                  <td className="py-3.5 px-6 text-right">{r.flight_count}</td>
                  <td className="py-3.5 px-6 text-right">{r.total_bookings}</td>
                  <td className="py-3.5 px-6 text-right font-bold text-slate-900">₹{Number(r.net_revenue).toLocaleString()}</td>
                  <td className="py-3.5 px-6 text-right font-semibold text-emerald-600">{r.avg_occupancy_pct}%</td>
                  <td className="py-3.5 px-6 text-right text-red-600">{r.cancellation_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
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
