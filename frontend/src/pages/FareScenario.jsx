import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Sliders, AlertTriangle, ArrowRight, DollarSign, Calculator, Sparkles } from 'lucide-react';

export default function FareScenario() {
  const [flights, setFlights] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState('');
  const [fareClass, setFareClass] = useState('ECONOMY');
  const [proposedFare, setProposedFare] = useState('');
  const [elasticity, setElasticity] = useState(-1.2);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/flights?limit=50')
      .then((res) => {
        setFlights(res.data);
        if (res.data.length > 0) {
          setSelectedFlight(res.data[0].flight_id);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  const handleSimulate = async (e) => {
    e.preventDefault();
    if (!selectedFlight || !proposedFare) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/analytics/fare-scenario', {
        flight_id: parseInt(selectedFlight),
        fare_class: fareClass,
        proposed_fare: parseFloat(proposedFare),
        demand_elasticity: parseFloat(elasticity)
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Simulation error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Fare Sensitivity & Revenue Scenario Analysis</h1>
        <p className="text-xs text-slate-500 mt-1">
          Rule-based microeconomic elasticity simulation. Explore hypothetical fare adjustments with explicit, user-configured demand sensitivity.
        </p>
      </div>

      {/* Explicit Disclaimer Alert */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Academic Project Disclaimer: </span>
          This tool executes a rule-based scenario model where demand shifts according to the explicit elasticity parameter entered below. It does not employ black-box machine learning or automated pricing adjustments.
        </div>
      </div>

      {/* Simulation Controls Form */}
      <div className="bg-surface p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <form onSubmit={handleSimulate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Select Flight */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Select Flight</label>
            <select
              value={selectedFlight}
              onChange={(e) => setSelectedFlight(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              {flights.map((f) => (
                <option key={f.flight_id} value={f.flight_id}>
                  {f.flight_number} ({f.origin_code} → {f.destination_code})
                </option>
              ))}
            </select>
          </div>

          {/* Fare Class */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Fare Class</label>
            <select
              value={fareClass}
              onChange={(e) => setFareClass(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="ECONOMY">Economy</option>
              <option value="BUSINESS">Business</option>
              <option value="FIRST">First Class</option>
            </select>
          </div>

          {/* Proposed Fare */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Proposed Fare (₹)</label>
            <input
              type="number"
              required
              min="500"
              step="50"
              value={proposedFare}
              onChange={(e) => setProposedFare(e.target.value)}
              placeholder="e.g. 6500"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Demand Elasticity */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-slate-700">Demand Elasticity (&epsilon;)</label>
              <span className="text-xs font-bold text-primary">{elasticity}</span>
            </div>
            <input
              type="range"
              min="-3.0"
              max="-0.2"
              step="0.1"
              value={elasticity}
              onChange={(e) => setElasticity(e.target.value)}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>Elastic (-3.0)</span>
              <span>Inelastic (-0.2)</span>
            </div>
          </div>

          {/* Run Button */}
          <div className="md:col-span-2 lg:col-span-4 flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading || !proposedFare}
              className="px-6 py-2.5 bg-primary hover:bg-blue-700 text-white font-semibold rounded-xl text-xs shadow-md shadow-blue-500/20 transition disabled:opacity-50 flex items-center gap-2"
            >
              <Calculator className="w-4 h-4" />
              <span>{loading ? "Simulating..." : "Calculate Revenue Impact"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Simulation Results Display */}
      {result && (
        <div className="bg-surface rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6 animate-fade-in">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-base">Simulation Outcome & Comparison</h3>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{result.fare_class} Class</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Original vs Proposed Fare */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[11px] font-semibold text-slate-400 uppercase">Fare Modification</div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm font-bold text-slate-500 line-through">₹{Number(result.original_fare).toLocaleString()}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-base font-extrabold text-blue-600">₹{Number(result.proposed_fare).toLocaleString()}</span>
              </div>
              <div className="text-[11px] font-semibold text-slate-600 mt-1">
                {result.pct_fare_change > 0 ? `+${result.pct_fare_change}% Increase` : `${result.pct_fare_change}% Decrease`}
              </div>
            </div>

            {/* Demand Impact */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[11px] font-semibold text-slate-400 uppercase">Seat Demand Shift</div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm font-bold text-slate-500">{result.current_seats_sold} seats</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-base font-extrabold text-slate-800">{result.estimated_seats_demanded} seats</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Assumed &epsilon; = {result.assumed_elasticity}</div>
            </div>

            {/* Original Revenue */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-[11px] font-semibold text-slate-400 uppercase">Current Baseline Revenue</div>
              <div className="text-base font-extrabold text-slate-800 mt-2">
                ₹{Number(result.original_revenue).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Confirmed booking totals</div>
            </div>

            {/* Projected Difference */}
            <div className={`p-4 rounded-xl border ${
              result.revenue_difference >= 0 ? 'bg-green-50/50 border-green-200' : 'bg-red-50/50 border-red-200'
            }`}>
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Estimated Net Impact</div>
              <div className={`text-base font-extrabold mt-2 ${
                result.revenue_difference >= 0 ? 'text-green-700' : 'text-red-700'
              }`}>
                {result.revenue_difference >= 0 ? '+' : ''}₹{Number(result.revenue_difference).toLocaleString()}
              </div>
              <div className="text-[11px] font-medium text-slate-600 mt-1">
                Projected Total: ₹{Number(result.estimated_revenue).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
