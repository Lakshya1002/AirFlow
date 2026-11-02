import React, { useState } from 'react';
import { Database, Copy, Check, X, Terminal } from 'lucide-react';

export default function SqlViewer({ title = "SQL Query Logic", sqlQuery, onClose }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (sqlQuery) {
      navigator.clipboard.writeText(sqlQuery);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!sqlQuery) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#0F172A] border border-slate-700 w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-[#1E293B] px-5 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-500/20 rounded-md text-blue-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">{title}</h3>
              <p className="text-xs text-slate-400">Database Engine Query executed natively in MySQL 8.0</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
              title="Copy SQL"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy SQL"}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Code Body */}
        <div className="p-5 overflow-auto flex-1 font-mono text-xs text-emerald-300 bg-[#0B1120] leading-relaxed select-text whitespace-pre-wrap">
          {sqlQuery}
        </div>

        {/* Footer */}
        <div className="bg-[#1E293B] px-5 py-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
          <span>Anti-double-counting architecture &bull; MySQL View/Procedure integration</span>
          <span className="text-blue-400 font-medium">Faculty Demonstration Ready</span>
        </div>
      </div>
    </div>
  );
}
