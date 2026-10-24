import React from 'react';
import { useAuth } from '../context/AuthContext';
import Icon from './Icons';

const PAGE_META = {
  leaderboard: ['Tổng quan thi đấu', 'Bảng xếp hạng'],
  pvp: ['Thi đấu trực tiếp', 'Đấu bot PvP'],
  boss: ['Khu luyện tập', 'Thử thách chiến thuật'],
  tournament: ['Thi đấu cạnh tranh', 'Giải đấu'],
  rules: ['Trung tâm hướng dẫn', 'Luật và chiến thuật'],
  database: ['Dữ liệu hệ thống', 'Lịch sử trận đấu'],
  bots: ['Không gian phát triển', 'Kho bot'],
  admin: ['Quản trị hệ thống', 'Bảng điều khiển'],
  replay: ['Phân tích trận đấu', 'Trình xem lại'],
};

export default function HeaderBar({ activeTab, onOpenAuthModal, theme, onToggleTheme }) {
  const { user, isAuthenticated, logout } = useAuth();
  const elo = user?.elo_rating || 1200;
  const tier = elo >= 1700 ? 'Thách đấu' : elo >= 1500 ? 'Kim cương' : elo >= 1350 ? 'Vàng' : elo >= 1200 ? 'Bạc' : 'Đồng';
  const [section, page] = PAGE_META[activeTab] || PAGE_META.leaderboard;

  return (
    <header className="app-header-new h-[72px] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="route-context min-w-0">
        <span>{section}</span>
        <strong>{page}</strong>
      </div>
      <div className="flex items-center gap-2">
        <span className="system-pill hidden lg:flex"><i className="status-dot" /> Máy chấm trực tuyến</span>
        <button type="button" onClick={onToggleTheme} className="icon-button" title={theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} /></button>
        {isAuthenticated ? (
          <>
            <div className="account-summary hidden sm:flex">
              <span className="user-avatar">{user.username.charAt(0).toUpperCase()}</span>
              <span className="account-copy"><b>{user.username}</b><small>{elo} Elo · {tier}</small></span>
            </div>
            <button type="button" onClick={logout} className="icon-button" title="Đăng xuất"><Icon name="logout" size={17} /></button>
          </>
        ) : (
          <button type="button" onClick={() => onOpenAuthModal('login')} className="primary-action"><Icon name="login" size={16} /> Đăng nhập</button>
        )}
      </div>
    </header>
  );
}
