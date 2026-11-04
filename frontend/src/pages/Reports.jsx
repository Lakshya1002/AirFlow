import React, { useState } from 'react';
import api from '../services/api';
import { FileSpreadsheet, Download, CheckCircle2, Clock } from 'lucide-react';

const reports = [
  {
    id: 'monthly-revenue',
    name: 'Monthly Revenue & Growth Report',
    description: 'Time-series gross, net, refund, and month-over-month (MoM) growth rates aggregated via vw_monthly_revenue with LAG window functions.',
    endpoint: '/reports/monthly-revenue',
    filename: 'monthly_revenue_report.csv',
  },
  {
    id: 'flight-performance',
    name: 'Flight Performance & Load Audit',
    description: 'Detailed revenue, confirmed vs cancelled bookings, and occupancy metrics for every scheduled flight via vw_flight_revenue.',
    endpoint: '/reports/flight-performance',
    filename: 'flight_performance_report.csv',
  },
  {
    id: 'route-performance',
    name: 'Route Corridor Yield Intelligence',
    description: 'Aggregate revenue, cancellation rate, distance, and flight volume across all 60 domestic & international routes via vw_route_performance.',
    endpoint: '/reports/route-performance',
    filename: 'route_performance_report.csv',
  },
  {
    id: 'seat-utilization',
    name: 'Seat Inventory & Utilization Log',
    description: 'Breakdown of sellable, confirmed, and maintenance-blocked seats with calculated load factor per flight via vw_seat_occupancy.',
    endpoint: '/reports/seat-utilization',
    filename: 'seat_utilization_report.csv',
  },
  {
    id: 'cancellations',
    name: 'Cancellations & Policy Refund Audit',
    description: 'All passenger booking cancellations with lead time before departure, documented reason, and computed policy refund amounts.',
    endpoint: '/reports/cancellations',
    filename: 'cancellations_report.csv',
  },
];

export default function Reports() {
  const [downloading, setDownloading] = useState({});

  const handleDownload = async (report) => {
    setDownloading((prev) => ({ ...prev, [report.id]: true }));
    try {
      const res = await api.get(report.endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', report.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Export error", err);
    } finally {
      setDownloading((prev) => ({ ...prev, [report.id]: false }));
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Operational & Financial Intelligence Reports</h1>
        <p className="text-xs text-slate-500 mt-1">
          Export full database view records directly to CSV. All files are generated dynamically from MySQL SQL queries.
        </p>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {reports.map((report) => (
          <div
            key={report.id}
            className="bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-slate-300 transition"
          >
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-blue-50 text-primary rounded-xl">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">{report.name}</h3>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">CSV Data Stream</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-6">
                {report.description}
              </p>
            </div>

            <button
              onClick={() => handleDownload(report)}
              disabled={downloading[report.id]}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition disabled:opacity-50"
            >
              {downloading[report.id] ? (
                <>
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating CSV...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  <span>Download CSV Export</span>
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

