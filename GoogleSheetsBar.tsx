import React from 'react';
import { Database, RefreshCw, CheckCircle2, FileSpreadsheet, ExternalLink, LogIn, LogOut } from 'lucide-react';
import { StockMedication } from '../types.ts';

interface GoogleSheetsBarProps {
  user: any | null;
  token: string | null;
  onLogin: () => void;
  onLogout: () => void;
  isLoggingIn: boolean;
  sheetUrl: string;
  setSheetUrl: (url: string) => void;
  onSyncSheet: () => void;
  isSyncing: boolean;
  stockCatalog: StockMedication[];
  activeSheetName: string;
  onResetToDefault: () => void;
}

export const GoogleSheetsBar: React.FC<GoogleSheetsBarProps> = ({
  user,
  token,
  onLogin,
  onLogout,
  isLoggingIn,
  sheetUrl,
  setSheetUrl,
  onSyncSheet,
  isSyncing,
  stockCatalog,
  activeSheetName,
  onResetToDefault,
}) => {
  return (
    <div id="google-sheets-section" className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs transition-all">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-slate-800 tracking-tight">
                Pharmacy Stock Catalog (valeurStockParDepot)
              </h2>
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                <Database className="w-3 h-3 text-slate-500" />
                {stockCatalog.length} medications loaded
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live inventory pricing source for automated cycle & total cost calculations
            </p>
          </div>
        </div>

        {/* User Google Auth Status */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          {user ? (
            <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-medium truncate max-w-[150px] sm:max-w-[200px]" title={user.email}>
                {user.email}
              </span>
              <button
                id="btn-google-logout"
                type="button"
                onClick={onLogout}
                className="text-slate-400 hover:text-rose-600 transition-colors ml-1 p-0.5"
                title="Disconnect Google Account"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              id="btn-google-signin"
              type="button"
              onClick={onLogin}
              disabled={isLoggingIn}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition shadow-xs disabled:opacity-60 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isLoggingIn ? 'Connecting...' : 'Connect Google Sheets'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Sync Google Sheets controls */}
      <div className="mt-3.5 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <input
            id="input-sheet-url"
            type="text"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder="Paste Google Sheet URL or ID (valeurStockParDepot)..."
            className="w-full text-xs sm:text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-sync-sheet"
            type="button"
            onClick={onSyncSheet}
            disabled={isSyncing}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-medium transition shadow-xs disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Fetch Sheet'}</span>
          </button>

          {activeSheetName !== 'Embedded Default Catalog' && (
            <button
              id="btn-reset-stock"
              type="button"
              onClick={onResetToDefault}
              className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1.5 transition underline cursor-pointer"
            >
              Reset to embedded
            </button>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1 text-slate-600">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Active: <strong className="text-slate-700 font-medium">{activeSheetName}</strong>
        </span>
        <span className="text-slate-400 hidden sm:inline">
          Columns: Price, Unit, Cat, Med Name, Code
        </span>
      </div>
    </div>
  );
};
