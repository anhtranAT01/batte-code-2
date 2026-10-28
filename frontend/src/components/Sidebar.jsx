import React from 'react';
import { useAuth } from '../context/AuthContext';
import Icon from './Icons';

export default function Sidebar({ activeTab, setActiveTab, onlineCount = 1, isCollapsed, setIsCollapsed, onPreloadTab }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'TEACHER';

  const sections = [
    {
      group: 'Thi đấu & Đấu trường',
      items: [
        { id: 'leaderboard', label: 'Tổng quan & Xếp hạng', icon: 'trophy' },
        { id: 'pvp', label: 'Đấu bot PvP', icon: 'swords', badge: 'LIVE' },
        { id: 'boss', label: 'Thử thách Boss AI', icon: 'boss' },
        { id: 'tournament', label: 'Giải đấu', icon: 'tournament', badge: 'CÚP' },
        { id: 'training', label: 'Luyện thuật toán AI', icon: 'algorithm', badge: 'LAB' },
        { id: 'rules', label: 'Luật chơi & Chiến thuật', icon: 'rules' },
      ],
    },
    {
      group: 'Kho lưu & Dữ liệu',
      items: [
        { id: 'database', label: 'Lịch sử trận đấu', icon: 'database' },
        { id: 'bots', label: 'Kho Bot của tôi', icon: 'bots' },
        ...(isAdmin ? [{ id: 'admin', label: 'Bảng quản trị', icon: 'admin', badge: 'ADMIN' }] : []),
      ],
    },
    {
      group: 'Hỗ trợ & Trạng thái',
      items: [
        { id: 'status', label: 'Trạng thái hệ thống', icon: 'cpu' },
        { id: 'chat', label: 'Hỏi đáp Ban tổ chức', icon: 'chat' },
      ],
    },
  ];

  return (
    <aside
      className={`app-sidebar flex-shrink-0 flex flex-col h-screen sticky top-0 select-none z-30 transition-all duration-300 ${
        isCollapsed ? 'w-[72px]' : 'w-[72px] md:w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="brand-block h-[72px] px-4 flex items-center justify-between gap-3">
        <div
          onClick={() => setActiveTab('leaderboard')}
          className="flex items-center gap-3 cursor-pointer min-w-0"
          title="BattleCode Arena - Trang chủ"
        >
          <div className="brand-mark" aria-label="BattleCode">
            BC
          </div>
          {!isCollapsed && (
            <div className="hidden md:block min-w-0">
              <h1 className="font-black text-[14px] tracking-[0.14em] theme-title leading-tight bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
                BATTLECODE
              </h1>
              <p className="text-[9px] font-bold tracking-[0.2em] theme-muted uppercase mt-0.5">
                AI ARENA 2026
              </p>
            </div>
          )}
        </div>

        {/* Toggle Collapse Button for desktop */}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
          title={isCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
          aria-label={isCollapsed?'Mở rộng thanh điều hướng':'Thu gọn thanh điều hướng'}
        >
          <Icon name={isCollapsed ? 'chevronRight' : 'chevronLeft'} size={16} />
        </button>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-6 scrollbar-thin">
        {sections.map((section) => (
          <div key={section.group} className="space-y-1">
            {!isCollapsed && (
              <div className="hidden md:block px-3 py-1 text-[9px] font-black tracking-[0.16em] theme-faint uppercase">
                {section.group}
              </div>
            )}
            {section.items.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  data-nav={item.id}
                  aria-current={active?'page':undefined}
                  aria-label={item.label}
                  type="button"
                  title={item.label}
                  onClick={() => setActiveTab(item.id)}
                  onPointerEnter={event => { if (event.pointerType === 'mouse') onPreloadTab?.(item.id); }}
                  onFocus={() => onPreloadTab?.(item.id)}
                  onPointerDown={() => onPreloadTab?.(item.id)}
                  className={`nav-item relative group ${active ? 'is-active' : ''}`}
                >
                  <span className="nav-icon">
                    <Icon name={item.icon} size={18} />
                  </span>

                  {!isCollapsed && (
                    <span className="hidden md:block truncate flex-1 text-left text-[13px]">
                      {item.label}
                    </span>
                  )}

                  {!isCollapsed && item.badge && (
                    <span
                      className={`hidden md:inline-flex px-1.5 py-0.5 text-[9px] font-black rounded-md tracking-wider ${
                        item.badge === 'LIVE'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                          : item.badge === 'CÚP'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : item.badge === 'LAB'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}

                  {/* Tooltip on collapsed desktop view */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-navy-950 text-white text-xs font-semibold rounded-lg shadow-xl border border-white/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                      {item.label}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer Info & Online Status */}
      <div className="sidebar-footer px-3 py-3 text-[11px] flex items-center justify-between bg-navy-950/40">
        <div className="flex items-center gap-2 min-w-0">
          <span className="status-dot" title="Hệ thống trực tuyến" />
          {!isCollapsed && (
            <span className="hidden md:inline font-mono text-[11px] text-slate-400 truncate">
              {onlineCount} Thí sinh online
            </span>
          )}
        </div>
        {!isCollapsed && (
          <span className="hidden md:inline font-mono text-[10px] text-slate-500 font-bold">
            v3.0
          </span>
        )}
      </div>
    </aside>
  );
}
