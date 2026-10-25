import React from 'react';
import { useAuth } from '../context/AuthContext';
import Icon from './Icons';
import { useSystemStatus } from '../lib/systemHealth';

const PAGE_META = {
  status: ['Hỗ trợ kỹ thuật', 'Trạng thái hệ thống'],
  leaderboard: ['Đấu trường AI', 'Tổng quan & Bảng xếp hạng'],
  pvp: ['Trận đấu trực tiếp', 'Đấu bot PvP'],
  boss: ['Khu vực thử thách', 'Đấu Boss AI'],
  tournament: ['Thi đấu đỉnh cao', 'Giải đấu AI'],
  training: ['Phòng thí nghiệm', 'Luyện thuật toán AI'],
  rules: ['Cẩm nang thi đấu', 'Luật chơi & Chiến thuật'],
  database: ['Dữ liệu lớn', 'Lịch sử trận đấu'],
  bots: ['Không gian lập trình', 'Kho bot của bạn'],
  admin: ['Khu vực quản trị', 'Bảng điều khiển Admin'],
  replay: ['Phân tích trận đấu', 'Trình xem lại ván cờ'],
};

export default function HeaderBar({ activeTab, onOpenAuthModal, theme, onToggleTheme, onNavigateTab }) {
  const { user, isAuthenticated, logout } = useAuth();
  const health = useSystemStatus();

  const elo = user?.elo_rating || 1200;
  const getTierInfo = (score) => {
    if (score >= 1700) return { name: 'Thách đấu', color: 'text-purple-400 bg-purple-500/15 border-purple-500/30' };
    if (score >= 1500) return { name: 'Kim cương', color: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30' };
    if (score >= 1350) return { name: 'Vàng', color: 'text-amber-400 bg-amber-500/15 border-amber-500/30' };
    if (score >= 1200) return { name: 'Bạc', color: 'text-slate-300 bg-slate-500/15 border-slate-500/30' };
    return { name: 'Đồng', color: 'text-orange-400 bg-orange-500/15 border-orange-500/30' };
  };

  const tier = getTierInfo(elo);
  const [section, page] = PAGE_META[activeTab] || PAGE_META.leaderboard;

  return (
    <header className="app-header-new h-[72px] px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-20">
      {/* Route Breadcrumb */}
      <div className="route-context min-w-0">
        <span className="text-[10px] font-bold tracking-widest uppercase text-blue-400">
          {section}
        </span>
        <strong className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
          {page}
        </strong>
      </div>

      {/* Right Controls Area */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Quick CTA to jump into action */}
        {onNavigateTab && (
          <button
            type="button"
            onClick={() => onNavigateTab('pvp')}
            className="hidden xl:inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 hover:border-blue-400 transition-colors"
          >
            <Icon name="zap" size={14} className="text-blue-400" />
            <span>Vào đấu trường</span>
          </button>
        )}

        {/* Server & Judge Status Pill */}
        <span
          className="system-pill hidden md:inline-flex"
          title="Trạng thái kết nối và máy chấm"
        >
          <i
            className="status-dot"
            style={{
              background:
                health.offline || health.unreachable
                  ? '#d97706'
                  : health.judge === 'online'
                  ? '#10b981'
                  : '#d97706',
            }}
          />
          <span className="text-xs">
            {health.offline
              ? 'Ngoại tuyến'
              : health.unreachable
              ? 'Mất kết nối máy chủ'
              : health.judge === 'online'
              ? 'Máy chấm sẵn sàng'
              : health.judge === 'paused'
              ? 'Máy chấm tạm dừng'
              : 'Đang kiểm tra...'}
          </span>
        </span>

        {/* Theme Switcher Button */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="icon-button"
          title={theme === 'dark' ? 'Chuyển sang Giao diện sáng' : 'Chuyển sang Giao diện tối'}
          aria-label="Đổi giao diện"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
        </button>

        {/* User Account / Login State */}
        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            <div className="account-summary flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-white/10 bg-navy-950/70">
              <span className="user-avatar text-xs font-bold">
                {user.username.charAt(0).toUpperCase()}
              </span>
              <div className="account-copy hidden sm:flex flex-col">
                <b className="text-xs font-bold text-white max-w-[120px] truncate">
                  {user.username}
                </b>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-mono text-slate-400 font-bold">
                    {elo} Elo
                  </span>
                  <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${tier.color}`}>
                    {tier.name}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="icon-button hover:text-red-400 hover:border-red-500/40"
              title="Đăng xuất khỏi tài khoản"
              aria-label="Đăng xuất"
            >
              <Icon name="logout" size={17} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenAuthModal('register')}
              className="secondary-action hidden sm:inline-flex text-xs"
            >
              Đăng ký
            </button>
            <button
              type="button"
              onClick={() => onOpenAuthModal('login')}
              className="primary-action text-xs"
            >
              <Icon name="login" size={15} />
              <span>Đăng nhập</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
