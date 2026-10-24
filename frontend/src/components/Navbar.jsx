import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ activeTab, setActiveTab, onOpenAuthModal }) {
  const { user, logout, isAuthenticated } = useAuth();

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-white/10 px-4 lg:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Live Badge */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('practice')}>
            <span className="text-2xl">⚔️</span>
            <span className="font-extrabold text-xl tracking-wider bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              RPS ARENA
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Cloudflare WSS 15s
          </span>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1.5 bg-dark-800/80 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveTab('practice')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'practice'
                ? 'bg-cyan-500 text-black font-semibold shadow-lg shadow-cyan-500/20'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            🎮 Luyện Tập
          </button>
          <button
            onClick={() => setActiveTab('replay')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'replay'
                ? 'bg-cyan-500 text-black font-semibold shadow-lg shadow-cyan-500/20'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            📹 Xem Lại Replay
          </button>
          <button
            onClick={() => setActiveTab('tournament')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'tournament'
                ? 'bg-cyan-500 text-black font-semibold shadow-lg shadow-cyan-500/20'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            🏆 Nộp Bot & Giải Đấu
          </button>
        </nav>

        {/* Authentication Profile / Button */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <div className="flex items-center gap-3 bg-dark-800/90 px-3.5 py-1.5 rounded-xl border border-white/10">
              <div className="flex flex-col text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="font-semibold text-sm text-white">{user.username}</span>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {user.role}
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-amber-400">
                  ⭐ Elo: {user.elo_rating ?? 1200}
                </span>
              </div>
              <button
                onClick={logout}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                title="Đăng xuất"
              >
                Đăng Xuất
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 transition-all transform hover:-translate-y-0.5"
            >
              Đăng Nhập / Tạo Tài Khoản
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
