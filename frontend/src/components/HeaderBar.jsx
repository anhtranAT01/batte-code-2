import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function HeaderBar({ onOpenAuthModal }) {
  const { user, isAuthenticated, logout } = useAuth();

  // Tier helper based on Elo
  const getTierInfo = (elo = 1200) => {
    if (elo >= 1700) return { name: 'THÁCH ĐẤU THẦN THOẠI', color: 'bg-gradient-to-r from-pink-500 to-purple-600 text-white border-pink-400/40', title: 'Đại Sư Thuật Toán' };
    if (elo >= 1500) return { name: 'KIM CƯƠNG BẬC THẦY', color: 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-400/40', title: 'Cao Thủ Chiến Thuật' };
    if (elo >= 1350) return { name: 'VÀNG DŨNG SĨ', color: 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-900 font-bold border-amber-300/40', title: 'Chiến Binh Quyết Đoán' };
    if (elo >= 1200) return { name: 'BẠC TINH ANH', color: 'bg-gradient-to-r from-slate-400 to-blue-300 text-slate-900 font-bold border-slate-300/40', title: 'Kỳ Thủ Nhập Môn' };
    return { name: 'ĐỒNG KỲ THỦ', color: 'bg-gradient-to-r from-amber-700 to-orange-700 text-white border-amber-600/40', title: 'Tân Binh Đấu Trường' };
  };

  const tier = getTierInfo(user?.elo_rating || 1200);

  return (
    <header className="h-16 border-b border-white/5 bg-[#090d18]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Left / Center Banner */}
      <div className="flex-1 flex items-center">
        {!isAuthenticated ? (
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-950/40 border border-indigo-500/20 text-xs text-slate-300 shadow-sm">
            <span className="text-slate-400 cursor-pointer">✕</span>
            <span>Chào mừng đến với Đấu Trường Battlecode 9x9!</span>
            <button
              onClick={() => onOpenAuthModal('login')}
              className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2 ml-1"
            >
              Đăng nhập
            </button>
            <span className="text-slate-500">•</span>
            <button
              onClick={() => onOpenAuthModal('register')}
              className="text-purple-400 hover:text-purple-300 font-semibold underline underline-offset-2"
            >
              Đăng ký tham gia
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {/* Player Avatar */}
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-0.5 shadow-md shadow-purple-500/20">
                <div className="w-full h-full bg-[#101426] rounded-full flex items-center justify-center font-bold text-white text-sm uppercase">
                  {user.username.charAt(0)}
                </div>
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#090d18]"></span>
            </div>

            {/* User Info */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">{user.username}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${tier.color}`}>
                  {tier.name}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{tier.title}</span>
                <span className="text-slate-600">•</span>
                <span className="text-amber-400 font-semibold">{user.elo_rating || 1200} Elo</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Indicators & Controls */}
      <div className="flex items-center gap-3">
        {/* FFA Gate Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-xs text-emerald-300 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Cổng FFA: Mở</span>
        </div>

        {/* Bonus Multiplier */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/40 border border-amber-500/20 text-xs text-amber-300 font-medium">
          <span>⚡</span>
          <span>Hệ số ngày: x1.5</span>
        </div>

        {/* Action Button */}
        {isAuthenticated ? (
          <button
            onClick={logout}
            title="Đăng xuất"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-white/5 hover:border-red-500/20 text-xs transition-colors"
          >
            <span>🚪</span>
            <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        ) : (
          <button
            onClick={() => onOpenAuthModal('login')}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-xs shadow-md shadow-indigo-950/50 transition-all"
          >
            Đăng Nhập
          </button>
        )}
      </div>
    </header>
  );
}
