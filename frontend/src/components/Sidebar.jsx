import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  MapPin,
  Plane,
  GitCommit,
  CalendarDays,
  Users,
  Ticket,
  CreditCard,
  DollarSign,
  Ban,
  TrendingUp,
  Armchair,
  Route as RouteIcon,
  Sliders,
  FileSpreadsheet
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { section: 'CORE INTELLIGENCE' },
  { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Revenue Analytics', path: '/analytics/revenue', icon: TrendingUp },
  { name: 'Seat Utilization', path: '/analytics/seats', icon: Armchair },
  { name: 'Route Performance', path: '/analytics/routes', icon: RouteIcon },
  { name: 'Fare Simulation', path: '/fare-scenario', icon: Sliders },
  { name: 'Reports & Exports', path: '/reports', icon: FileSpreadsheet },

  { section: 'OPERATIONS & BOOKING' },
  { name: 'Flights', path: '/flights', icon: CalendarDays },
  { name: 'Bookings', path: '/bookings', icon: Ticket },
  { name: 'Passengers', path: '/passengers', icon: Users },
  { name: 'Payments', path: '/payments', icon: CreditCard },
  { name: 'Fares Schedule', path: '/fares', icon: DollarSign },
  { name: 'Cancellations', path: '/cancellations', icon: Ban },

  { section: 'MASTER DATA' },
  { name: 'Airlines', path: '/airlines', icon: Building2 },
  { name: 'Airports', path: '/airports', icon: MapPin },
  { name: 'Aircraft Fleet', path: '/aircraft', icon: Plane },
  { name: 'Routes', path: '/routes', icon: GitCommit },
];

export default function Sidebar() {
  const { role } = useAuth();

  return (
    <aside className="w-64 bg-navy text-slate-300 flex flex-col h-screen fixed left-0 top-0 border-r border-slate-800 z-30 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-lg shadow-md shadow-blue-500/20">
          ✈
        </div>
        <div>
          <h1 className="font-extrabold text-white tracking-wider text-base">AIR-FLOW</h1>
          <p className="text-[10px] text-blue-400 font-medium tracking-tight">SQL INTELLIGENCE ENGINE</p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 text-xs">
        {navItems.map((item, index) => {
          if (item.section) {
            return (
              <div key={index} className="pt-4 pb-1.5 px-3 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                {item.section}
              </div>
            );
          }

          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </div>

      {/* User Status Footer */}
      <div className="p-3 border-t border-slate-800 bg-[#0C152B]">
        <div className="flex items-center justify-between text-xs px-2">
          <span className="text-slate-400">Database Engine:</span>
          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            MySQL 8.0 Live
          </span>
        </div>
      </div>
    </aside>
  );
}
