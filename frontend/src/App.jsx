import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RevenueAnalytics from './pages/RevenueAnalytics';
import SeatAnalytics from './pages/SeatAnalytics';
import RouteAnalytics from './pages/RouteAnalytics';
import FareScenario from './pages/FareScenario';
import Reports from './pages/Reports';

import Flights from './pages/Flights';
import Bookings from './pages/Bookings';
import Passengers from './pages/Passengers';
import Payments from './pages/Payments';
import Fares from './pages/Fares';
import Cancellations from './pages/Cancellations';

import Airlines from './pages/Airlines';
import Airports from './pages/Airports';
import Aircraft from './pages/Aircraft';
import RoutesPage from './pages/Routes';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Protected Application Routes */}
          <Route path="/" element={<DashboardLayout title="Executive Overview" />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="analytics/revenue" element={<RevenueAnalytics />} />
            <Route path="analytics/seats" element={<SeatAnalytics />} />
            <Route path="analytics/routes" element={<RouteAnalytics />} />
            <Route path="fare-scenario" element={<FareScenario />} />
            <Route path="reports" element={<Reports />} />

            <Route path="flights" element={<Flights />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="passengers" element={<Passengers />} />
            <Route path="payments" element={<Payments />} />
            <Route path="fares" element={<Fares />} />
            <Route path="cancellations" element={<Cancellations />} />

            <Route path="airlines" element={<Airlines />} />
            <Route path="airports" element={<Airports />} />
            <Route path="aircraft" element={<Aircraft />} />
            <Route path="routes" element={<RoutesPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
