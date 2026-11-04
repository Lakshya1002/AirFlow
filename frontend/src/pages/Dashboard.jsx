import React, { useState, useEffect } from 'react';
import api from '../services/api';
import SqlViewer from '../components/SqlViewer';
import {
  DollarSign,
  Ticket,
  Plane,
  Percent,
  Users,
  Ban,
  Database,
  RefreshCw,
  TrendingUp,
  Award,
  Layers
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const PIE_COLORS = ['#16A34A', '#DC2626', '#F59E0B'];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSql, setActiveSql] = useState(null);

  const fetchDashboard = () => {
    setLoading(true);
    api.get('/analytics/dashboard')
      .then((res) => setData(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-medium">Aggregating live analytics from MySQL views...</p>
      </div>
    );
  }

  const { kpis, monthly_trend, airline_revenue, route_revenue, booking_status_dist, fare_class_perf, sql } = data || {};

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Top Banner with SQL Inspector Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Executive Revenue & Utilization Intelligence</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time metric synthesis powered entirely by MySQL 8.0 views, window functions, and CTEs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveSql({
              title: "Dashboard Aggregate Queries (Anti-Double-Counting Architecture)",
              query: Object.entries(sql || {}).map(([k, v]) => `-- [${k.toUpperCase()}]\n${v}\n`).join('\n')
            })}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition"
          >
            <Database className="w-4 h-4 text-blue-400" />
            <span>SQL Behind Dashboard</span>
          </button>
          <button
            onClick={fetchDashboard}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
            title="Refresh Metrics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Net Revenue */}
        <div className="bg-surface p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Net Revenue</span>
            <div className="p-2 bg-blue-50 text-primary rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-slate-900 tracking-tight">
            ₹{Number(kpis?.total_net_revenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">Gross − Confirmed Refunds</div>
        </div>

        {/* Total Bookings */}
        <div className="bg-surface p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Total Bookings</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-slate-900 tracking-tight">
            {Number(kpis?.total_bookings || 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">Confirmed & Cancelled</div>
        </div>

        {/* Total Flights */}
        <div className="bg-surface p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Active Flights</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Plane className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-slate-900 tracking-tight">
            {Number(kpis?.total_flights || 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">Across 60 Active Routes</div>
        </div>

        {/* Avg Seat Occupancy */}
        <div className="bg-surface p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Seat Occupancy</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-slate-900 tracking-tight">
            {kpis?.avg_occupancy_pct || 0}%
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">Confirmed / Sellable</div>
        </div>

        {/* Passengers */}
        <div className="bg-surface p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Passengers</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-slate-900 tracking-tight">
            {Number(kpis?.total_passengers || 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">Registered Directory</div>
        </div>

        {/* Cancellation Rate */}
        <div className="bg-surface p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Cancellation Rate</span>
            <div className="p-2 bg-red-50 text-red-600 rounded-xl">
              <Ban className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-slate-900 tracking-tight">
            {kpis?.cancellation_rate || 0}%
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">Policy Refunded Bookings</div>
        </div>
      </div>

      {/* Row 1 Charts: Monthly Trend Line & Airline Revenue Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue Trend */}
        <div className="bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Monthly Net Revenue Trajectory</h3>
              <p className="text-xs text-slate-400">Computed via vw_monthly_revenue with LAG window functions</p>
            </div>
            <button
              onClick={() => setActiveSql({ title: "Monthly Revenue (vw_monthly_revenue)", query: sql?.monthly_trend })}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <Database className="w-3.5 h-3.5" /> View SQL
            </button>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly_trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="revenue_month" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickFormatter={(val) => `₹${(val / 100000).toFixed(0)}L`}
                />
                <Tooltip
                  formatter={(value) => [`₹${Number(value).toLocaleString()}`, 'Net Revenue']}
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Line type="monotone" dataKey="net_revenue" stroke="#2563EB" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by Airline */}
        <div className="bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Revenue by Airline Carrier</h3>
              <p className="text-xs text-slate-400">Aggregated from pre-joined booking CTEs</p>
            </div>
            <button
              onClick={() => setActiveSql({ title: "Revenue by Airline Carrier", query: sql?.airline_revenue })}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <Database className="w-3.5 h-3.5" /> View SQL
            </button>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={airline_revenue} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickFormatter={(val) => `₹${(val / 100000).toFixed(0)}L`}
                />
                <YAxis dataKey="airline_code" type="category" tick={{ fontSize: 11, fill: '#64748B' }} width={40} />
                <Tooltip
                  formatter={(value) => [`₹${Number(value).toLocaleString()}`, 'Net Revenue']}
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="net_revenue" fill="#3B82F6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2 Charts: Route Revenue, Booking Distribution, Fare Class Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Routes Revenue */}
        <div className="bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Top Revenue Routes</h3>
              <p className="text-xs text-slate-400">From vw_route_performance</p>
            </div>
            <button
              onClick={() => setActiveSql({ title: "Top Route Performance View", query: sql?.route_revenue })}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <Database className="w-3.5 h-3.5" /> View SQL
            </button>
          </div>
          <div className="space-y-3">
            {route_revenue?.slice(0, 5).map((route, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <div className="text-xs font-bold text-slate-800">{route.route_label}</div>
                  <div className="text-[10px] text-slate-400">{route.flight_count} Flights &bull; {route.avg_occupancy_pct}% Occ</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-extrabold text-blue-600">₹{Number(route.net_revenue).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Booking Status Distribution */}
        <div className="bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Booking Status Split</h3>
              <p className="text-xs text-slate-400">Inventory conversion ratios</p>
            </div>
            <button
              onClick={() => setActiveSql({ title: "Booking Distribution Query", query: sql?.booking_status_dist })}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <Database className="w-3.5 h-3.5" /> View SQL
            </button>
          </div>
          <div className="h-52 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={booking_status_dist}
                  dataKey="count"
                  nameKey="booking_status"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                >
                  {booking_status_dist?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val, name) => [`${val} Bookings`, name]}
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fare Class Revenue Contribution */}
        <div className="bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Fare Class Contribution</h3>
              <p className="text-xs text-slate-400">Economy vs Business vs First</p>
            </div>
            <button
              onClick={() => setActiveSql({ title: "Fare Class Performance", query: sql?.fare_class_perf })}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <Database className="w-3.5 h-3.5" /> View SQL
            </button>
          </div>
          <div className="space-y-4 pt-2">
            {fare_class_perf?.map((cls, i) => (
              <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-800">{cls.fare_class} CLASS</span>
                  <span className="text-xs font-extrabold text-slate-900">₹{Number(cls.gross_revenue).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Confirmed Seats Sold</span>
                  <span className="font-semibold text-slate-700">{cls.seats_sold.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SQL Modal for Faculty Demonstration */}
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

