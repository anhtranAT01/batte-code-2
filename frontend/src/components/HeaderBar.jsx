import React from 'react';
import { useAuth } from '../context/AuthContext';
import Icon from './Icons';

export default function HeaderBar({ onOpenAuthModal, theme, onToggleTheme }) {
  const { user, isAuthenticated, logout } = useAuth();
  const elo = user?.elo_rating || 1200;
  const tier = elo >= 1700 ? 'Thách đấu' : elo >= 1500 ? 'Kim cương' : elo >= 1350 ? 'Vàng' : elo >= 1200 ? 'Bạc' : 'Đồng';

  return (
    <header className="app-header-new h-[72px] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="min-w-0">
        {isAuthenticated ? (
          <div className="flex items-center gap-3">
            <div className="user-avatar">{user.username.charAt(0).toUpperCase()}</div>
            <div className="min-w-0">
              <div className="flex items-center gap-2"><span className="font-bold text-sm theme-title truncate">{user.username}</span><span className="tier-pill">{tier}</span></div>
              <p className="text-xs theme-muted mt-0.5">{elo} Elo · {user.role || 'STUDENT'}</p>
            </div>
          </div>
        ) : (
          <div><p className="font-bold text-sm theme-title">Đấu trường chiến thuật</p><p className="text-xs theme-muted mt-0.5 hidden sm:block">Viết bot, thi đấu và theo dõi thứ hạng theo thời gian thực</p></div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="system-pill hidden lg:flex"><i className="status-dot" /> Máy chấm trực tuyến</span>
        <button type="button" onClick={onToggleTheme} className="icon-button" title={theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} /></button>
        {isAuthenticated ? (
          <button type="button" onClick={logout} className="secondary-action"><Icon name="logout" size={16} /><span className="hidden sm:inline">Đăng xuất</span></button>
        ) : (
          <button type="button" onClick={() => onOpenAuthModal('login')} className="primary-action"><Icon name="login" size={16} /> Đăng nhập</button>
        )}
      </div>
    </header>
  );
}
