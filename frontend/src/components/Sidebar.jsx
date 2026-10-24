import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ activeTab, setActiveTab, onlineCount = 1 }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'TEACHER';

  const navSections = [
    {
      group: 'ĐẤU TRƯỜNG & CHIẾN ĐẤU',
      items: [
        { id: 'leaderboard', label: 'Bảng Xếp Hạng', icon: '🏆' },
        { id: 'pvp', label: 'Đấu Bot 2 Người', icon: '⚔️', badge: 'PvP', badgeColor: 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-sm' },
        { id: 'boss', label: 'Luyện Tập Boss AI', icon: '🤖', badge: 'Bot Máy', badgeColor: 'bg-slate-700/60 text-slate-300 border border-slate-600/40' },
        { id: 'tournament', label: 'Giải Đấu & Nhánh', icon: '🌲' },
        { id: 'rules', label: 'Luật & Chiến Thuật', icon: '📖' },
      ],
    },
    {
      group: 'DỮ LIỆU & TÀI KHOẢN',
      items: [
        { id: 'database', label: 'Cơ Sở Dữ Liệu', icon: '📊' },
        { id: 'bots', label: 'Hồ Sơ & Kho Bot', icon: '👤' },
        ...(isAdmin
          ? [
              {
                id: 'admin',
                label: 'Quản Trị Hệ Thống',
                icon: '🛡️',
                badge: 'ADMIN',
                badgeColor: 'bg-red-500/20 text-red-300 border border-red-500/30',
              },
            ]
          : []),
      ],
    },
    {
      group: 'CỘNG ĐỒNG',
      items: [
        {
          id: 'chat',
          label: 'Kênh Thế Giới',
          icon: '💬',
          onlineStatus: `${onlineCount} Trực tuyến`,
        },
      ],
    },
  ];

  return (
    <aside className="w-64 flex-shrink-0 bg-[#0c101d] border-r border-white/5 flex flex-col h-screen sticky top-0 select-none z-30">
      {/* Brand Header */}
      <div className="p-5 border-b border-white/5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 p-0.5 shadow-lg shadow-purple-500/20 flex items-center justify-center">
          <div className="w-full h-full bg-[#0c101d] rounded-[10px] flex items-center justify-center text-xl">
            ⚔️
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="font-bold text-base tracking-wider text-white">BATTLECODE</h1>
          </div>
          <p className="text-[10px] font-semibold tracking-wider text-purple-400">9x9 RPS CHESS</p>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin">
        {navSections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1.5">
            <div className="px-3 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              {section.group}
            </div>

            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/20 text-white border border-indigo-500/30 shadow-md shadow-indigo-950/40'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-base transition-transform group-hover:scale-110 ${isActive ? 'scale-110' : ''}`}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </div>

                    {item.badge && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}

                    {item.onlineStatus && (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="font-normal text-slate-400">{item.onlineStatus}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* System Status footer */}
      <div className="p-4 border-t border-white/5 bg-[#090d18]/60 text-xs text-slate-500 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span className="text-[11px] text-slate-400">Máy Chấm AI: Sẵn sàng</span>
        </div>
        <span className="text-[10px] font-mono text-slate-500">v2.4</span>
      </div>
    </aside>
  );
}
