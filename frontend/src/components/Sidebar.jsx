import React from 'react';
import { useAuth } from '../context/AuthContext';
import Icon from './Icons';

export default function Sidebar({ activeTab, setActiveTab, onlineCount = 1 }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'TEACHER';
  const sections = [
    { group: 'Thi đấu', items: [
      { id: 'leaderboard', label: 'Bảng xếp hạng', icon: 'leaderboard' },
      { id: 'pvp', label: 'Đấu bot PvP', icon: 'pvp', badge: 'LIVE' },
      { id: 'boss', label: 'Luyện tập', icon: 'boss' },
      { id: 'tournament', label: 'Giải đấu', icon: 'tournament' },
      { id: 'rules', label: 'Luật & chiến thuật', icon: 'rules' },
    ]},
    { group: 'Quản lý', items: [
      { id: 'database', label: 'Dữ liệu trận đấu', icon: 'database' },
      { id: 'bots', label: 'Kho bot', icon: 'bots' },
      ...(isAdmin ? [{ id: 'admin', label: 'Quản trị', icon: 'admin', badge: 'ADMIN' }] : []),
    ]},
    { group: 'Cộng đồng', items: [
      { id: 'chat', label: 'Kênh trò chuyện', icon: 'chat', onlineStatus: onlineCount },
    ]},
  ];

  return (
    <aside className="app-sidebar w-[76px] md:w-64 flex-shrink-0 flex flex-col h-screen sticky top-0 select-none z-30">
      <div className="brand-block h-[72px] px-4 md:px-5 flex items-center gap-3">
        <div className="brand-mark" aria-label="BattleCode">BC</div>
        <div className="hidden md:block min-w-0">
          <h1 className="font-extrabold text-[15px] tracking-[0.12em] theme-title">BATTLECODE</h1>
          <p className="text-[10px] font-semibold tracking-[0.16em] theme-muted mt-0.5">TACTICAL ARENA</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2.5 md:px-3 py-5 space-y-6 scrollbar-thin">
        {sections.map((section) => (
          <div key={section.group} className="space-y-1.5">
            <div className="hidden md:block px-3 text-[10px] font-bold tracking-[0.16em] theme-faint uppercase">{section.group}</div>
            {section.items.map((item) => {
              const active = activeTab === item.id;
              return (
                <button key={item.id} type="button" title={item.label} onClick={() => setActiveTab(item.id)} className={`nav-item ${active ? 'is-active' : ''}`}>
                  <span className="nav-icon"><Icon name={item.icon} size={19} /></span>
                  <span className="hidden md:block truncate flex-1 text-left">{item.label}</span>
                  {item.badge && <span className="hidden md:inline nav-badge">{item.badge}</span>}
                  {item.onlineStatus !== undefined && <span className="hidden md:flex items-center gap-1.5 text-[10px] theme-muted"><i className="status-dot" />{item.onlineStatus}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="hidden md:flex sidebar-footer items-center justify-between px-5 py-4 text-[11px]">
        <span className="flex items-center gap-2 theme-muted"><i className="status-dot" /> Hệ thống sẵn sàng</span>
        <span className="font-mono theme-faint">v2.4</span>
      </div>
    </aside>
  );
}
