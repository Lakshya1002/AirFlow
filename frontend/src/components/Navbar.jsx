import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, ShieldCheck } from 'lucide-react';

export default function Navbar({ pageTitle = "Dashboard" }) {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-surface border-b border-slate-200/80 px-8 flex items-center justify-between sticky top-0 z-20 shadow-sm">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-slate-800">{pageTitle}</h2>
      </div>

      <div className="flex items-center gap-4">
        {/* Role Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full border border-slate-200 text-xs">
          <ShieldCheck className={`w-3.5 h-3.5 ${user?.role === 'ADMIN' ? 'text-blue-600' : 'text-emerald-600'}`} />
          <span className="font-semibold text-slate-700">{user?.role || 'ANALYST'}</span>
          <span className="text-slate-400">&bull;</span>
          <span className="text-slate-600">{user?.username || 'User'}</span>
        </div>

        {/* Logout Button */}
        <button
          onClick={logout}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
          title="Sign out"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}

