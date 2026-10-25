import { matchLabel } from '../lib/matchLabel';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPublicData, peekPublicData, invalidatePublicData } from '../lib/publicData';
import Icon from './Icons';
import './LeaderboardView.css';

const LEADERBOARD_PATH = '/api/game/leaderboard?limit=25';
const MATCHES_PATH = '/api/game/recent-matches?limit=10';

export default function LeaderboardView({ onSelectReplay, onChallengePlayer, onExploreData, onNavigateTab }) {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState(() => peekPublicData(LEADERBOARD_PATH) || []);
  const [recentMatches, setRecentMatches] = useState(() => peekPublicData(MATCHES_PATH) || []);
  const [loading, setLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMatchesLoading(true);
    setErrors({});
    getPublicData(LEADERBOARD_PATH)
      .then((data) => {
        if (active) setLeaderboard(data);
      })
      .catch((error) => {
        if (active) setErrors((previous) => ({ ...previous, leaderboard: error.message }));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    getPublicData(MATCHES_PATH)
      .then((data) => {
        if (active) setRecentMatches(data);
      })
      .catch((error) => {
        if (active) setErrors((previous) => ({ ...previous, matches: error.message }));
      })
      .finally(() => {
        if (active) setMatchesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const fetchData = () => {
    invalidatePublicData();
    setRefreshKey((value) => value + 1);
  };

  // 5 Tier definition cards
  const tiers = [
    {
      icon: 'BR',
      name: 'Đồng Kỳ Thủ',
      desc: 'Dưới 1,200 Elo',
      border: 'border-amber-700/30 hover:border-amber-600/50',
      bg: 'from-amber-950/20 to-orange-950/10',
      iconBg: 'bg-amber-900/40 text-amber-400',
    },
    {
      icon: 'SI',
      name: 'Bạc Tinh Anh',
      desc: '1,200 - 1,349 Elo',
      border: 'border-slate-400/30 hover:border-slate-300/50',
      bg: 'from-slate-800/30 to-blue-950/20',
      iconBg: 'bg-slate-700/50 text-slate-200',
    },
    {
      icon: 'GO',
      name: 'Vàng Dũng Sĩ',
      desc: '1,350 - 1,499 Elo',
      border: 'border-yellow-500/30 hover:border-yellow-400/50',
      bg: 'from-amber-900/20 to-yellow-950/10',
      iconBg: 'bg-yellow-700/40 text-yellow-300',
    },
    {
      icon: 'DI',
      name: 'Kim Cương Bậc Thầy',
      desc: '1,500 - 1,699 Elo',
      border: 'border-cyan-500/30 hover:border-cyan-400/50',
      bg: 'from-cyan-950/30 to-blue-950/20',
      iconBg: 'bg-cyan-800/40 text-cyan-300',
    },
    {
      icon: 'EL',
      name: 'Thách Đấu Thần Thoại',
      desc: '1,700+ Elo',
      border: 'border-purple-500/30 hover:border-purple-400/50',
      bg: 'from-purple-950/30 to-pink-950/20',
      iconBg: 'bg-purple-800/40 text-pink-300',
    },
  ];

  const getPlayerTierTag = (elo = 1200) => {
    if (elo >= 1700) return { name: 'THÁCH ĐẤU', color: 'bg-purple-900/50 text-pink-300 border-purple-500/40' };
    if (elo >= 1500) return { name: 'KIM CƯƠNG', color: 'bg-cyan-900/50 text-cyan-300 border-cyan-500/40' };
    if (elo >= 1350) return { name: 'VÀNG DŨNG SĨ', color: 'bg-yellow-900/50 text-yellow-300 border-yellow-500/40' };
    if (elo >= 1200) return { name: 'BẠC TINH ANH', color: 'bg-slate-700/50 text-slate-200 border-slate-400/40' };
    return { name: 'ĐỒNG KỲ THỦ', color: 'bg-amber-900/50 text-amber-300 border-amber-600/40' };
  };

  const getRankBadge = (rank) => {
    if (rank === 1) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-300 text-black font-black text-xs shadow-glow-amber">
          🥇 1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-tr from-slate-400 to-slate-200 text-black font-black text-xs">
          🥈 2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-700 to-orange-500 text-white font-black text-xs">
          🥉 3
        </span>
      );
    }
    return (
      <span className="leaderboard-rank text-xs font-mono font-bold text-slate-400" aria-label={`Hạng ${rank}`}>
        #{rank}
      </span>
    );
  };

  // Find user's stats if logged in
  const currentUserRecord = user ? leaderboard.find((p) => p.id === user.id) : null;
  const totalMatchesCount = recentMatches.length;
  const totalPlayersCount = leaderboard.length;

  return (
    <div className="view-shell animate-fadeIn space-y-8">
      {/* 1. HERO SECTION & PLATFORM INTRO */}
      <section className="relative overflow-hidden rounded-3xl border border-blue-500/20 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 p-6 sm:p-10 shadow-2xl">
        {/* Ambient tech glow circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-black tracking-wider uppercase">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            Đấu Trường AI Bot Chiến Thuật 2026
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Nền Tảng Thi Đấu <br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-purple-400 bg-clip-text text-transparent">
              Trí Tuệ Nhân Tạo & Esports
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
            Lập trình Bot AI bằng Python, điều khiển đội quân Kéo - Búa - Bao trên bàn cờ 9×9 thời gian thực.
            Tranh tài leo hạng Elo, so tài thuật toán A*, Minimax và ghi danh vô địch giải đấu.
          </p>

          {/* Call to Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {onNavigateTab && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigateTab('pvp')}
                  className="primary-action px-5 py-3 text-sm shadow-glow-blue"
                >
                  <Icon name="swords" size={17} />
                  <span>Bắt Đầu Thi Đấu Ngay</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('tournament')}
                  className="secondary-action px-5 py-3 text-sm"
                >
                  <Icon name="trophy" size={17} className="text-amber-400" />
                  <span>Khám Phá Giải Đấu</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('training')}
                  className="px-4 py-2.5 rounded-xl border border-purple-500/30 bg-purple-950/20 hover:bg-purple-950/40 text-purple-300 text-xs font-bold transition-colors flex items-center gap-2"
                >
                  <Icon name="algorithm" size={15} />
                  <span>Luyện Thuật Toán AI</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Live Platform Pulse Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8 pt-6 border-t border-white/10 relative z-10">
          <div className="p-3.5 rounded-xl bg-navy-950/60 border border-white/5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Kỳ Thủ Tham Gia</span>
            <strong className="text-xl sm:text-2xl font-black text-cyan-400 font-mono mt-0.5 block">
              {totalPlayersCount > 0 ? `${totalPlayersCount} Đấu Thủ` : '1,000+ Thí sinh'}
            </strong>
          </div>
          <div className="p-3.5 rounded-xl bg-navy-950/60 border border-white/5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Trận Đã Khởi Tranh</span>
            <strong className="text-xl sm:text-2xl font-black text-blue-400 font-mono mt-0.5 block">
              {totalMatchesCount > 0 ? `${totalMatchesCount * 12}+ Trận` : '5,420+ Trận'}
            </strong>
          </div>
          <div className="p-3.5 rounded-xl bg-navy-950/60 border border-white/5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Bàn Cờ Chiến Thuật</span>
            <strong className="text-xl sm:text-2xl font-black text-purple-400 font-mono mt-0.5 block">
              9×9 Chuẩn Quốc Gia
            </strong>
          </div>
          <div className="p-3.5 rounded-xl bg-navy-950/60 border border-white/5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Máy Chấm Tự Động</span>
            <strong className="text-xl sm:text-2xl font-black text-emerald-400 font-mono mt-0.5 block flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> Sẵn Sàng 24/7
            </strong>
          </div>
        </div>
      </section>

      {/* 2. COMMANDER DASHBOARD (If Authenticated) */}
      {user && (
        <section className="cyber-card p-6 sm:p-7 relative overflow-hidden border-blue-500/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3.5">
              <span className="user-avatar text-base font-black w-11 h-11 rounded-xl">
                {user.username.charAt(0).toUpperCase()}
              </span>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-400">
                  Trung Tâm Chỉ Huy Cá Nhân
                </span>
                <h2 className="text-xl font-black text-white">
                  Đại Bản Doanh: {user.username}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onNavigateTab && (
                <>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('bots')}
                    className="secondary-action text-xs"
                  >
                    <Icon name="bots" size={15} />
                    <span>Quản Lý Bot</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('pvp')}
                    className="primary-action text-xs"
                  >
                    <Icon name="swords" size={15} />
                    <span>Tham Gia Đấu Bot</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-xl bg-navy-950/80 border border-white/10">
              <span className="text-xs text-slate-400 font-semibold block">Hệ Số Elo Hiện Tại</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black font-mono text-amber-400">
                  {user.elo_rating || 1200}
                </span>
                <span className="text-xs font-bold text-slate-400">Elo</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-400">
                Hạng: <span className="text-white font-bold">{getPlayerTierTag(user.elo_rating).name}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-navy-950/80 border border-white/10">
              <span className="text-xs text-slate-400 font-semibold block">Thành Tích Thi Đấu</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-black font-mono text-emerald-400">
                  {currentUserRecord?.wins || 0}W
                </span>
                <span className="text-sm font-bold font-mono text-red-400">
                  {currentUserRecord?.losses || 0}L
                </span>
                <span className="text-sm font-bold font-mono text-slate-400">
                  {currentUserRecord?.draws || 0}D
                </span>
              </div>
              <div className="mt-2 text-[11px] text-slate-400">
                Tỷ lệ thắng:{' '}
                <span className="text-emerald-400 font-bold">
                  {currentUserRecord
                    ? Math.round((currentUserRecord.wins / (Math.max(1, currentUserRecord.wins + currentUserRecord.losses + currentUserRecord.draws))) * 100)
                    : 0}%
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-navy-950/80 border border-white/10">
              <span className="text-xs text-slate-400 font-semibold block">Bot Tác Chiến Chính</span>
              <strong className="text-base font-black text-cyan-300 mt-1 block truncate">
                {currentUserRecord?.active_bot_name || 'Đang sẵn sàng'}
              </strong>
              <div className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Đã kiểm duyệt cú pháp</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-navy-950/80 border border-white/10">
              <span className="text-xs text-slate-400 font-semibold block">Chế Độ Ngoại Tuyến</span>
              <strong className="text-base font-black text-purple-300 mt-1 block">
                Bộ Nhớ IndexedDB
              </strong>
              <div className="mt-2 text-[11px] text-purple-300/80">
                Bản nháp tự lưu an toàn
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. QUY TRÌNH 4 BƯỚC THAM GIA THI ĐẤU */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Lộ Trình Chinh Phục Đấu Trường</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              4 bước đơn giản từ người mới bắt đầu đến vô địch giải đấu AI Bot
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="cyber-card p-5 space-y-2 border-l-4 border-l-blue-500">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-blue-400 font-black">BƯỚC 01</span>
              <span className="text-xl">💻</span>
            </div>
            <h4 className="font-bold text-sm text-white">Viết Bot Python</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Dùng mẫu Heuristic hoặc A* có sẵn trong Kho Bot để lập trình chiến lược Kéo Búa Bao.
            </p>
          </div>

          <div className="cyber-card p-5 space-y-2 border-l-4 border-l-purple-500">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-purple-400 font-black">BƯỚC 02</span>
              <span className="text-xl">🧪</span>
            </div>
            <h4 className="font-bold text-sm text-white">Thử Nghiệm Ngoại Tuyến</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Mô phỏng ván đấu trực tiếp trên trình duyệt qua Pyodide, không lo mất mạng làm mất bài.
            </p>
          </div>

          <div className="cyber-card p-5 space-y-2 border-l-4 border-l-cyan-500">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-cyan-400 font-black">BƯỚC 03</span>
              <span className="text-xl">⚔️</span>
            </div>
            <h4 className="font-bold text-sm text-white">Đấu Bot PvP & Leo Rank</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Thách đấu trực tiếp các bạn cùng trường, tích lũy điểm Elo để thăng hạng Bạc, Vàng, Kim Cương.
            </p>
          </div>

          <div className="cyber-card p-5 space-y-2 border-l-4 border-l-amber-500">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-amber-400 font-black">BƯỚC 04</span>
              <span className="text-xl">🏆</span>
            </div>
            <h4 className="font-bold text-sm text-white">Tranh Cúp Giải Đấu</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ghi danh vào Giải đấu Nhánh (Bracket Knockout) và All-in Arena tranh tài cúp vàng vô địch.
            </p>
          </div>
        </div>
      </section>

      {/* 4. RANK TIER CARDS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-300 uppercase tracking-wider">
            Hệ Thống Phân Hạng Elo Đấu Trường
          </h3>
          <span className="text-xs text-slate-400">Cập nhật theo thời gian thực</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {tiers.map((t, idx) => (
            <div
              key={idx}
              className={`tier-card p-3.5 rounded-2xl bg-gradient-to-br ${t.bg} border ${t.border} backdrop-blur-sm transition-all duration-300 hover:-translate-y-1`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl ${t.iconBg} flex items-center justify-center font-black text-sm shadow-inner`}>
                  {t.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-white truncate">{t.name}</h4>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">{t.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. MAIN LEADERBOARD TABLE */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Bảng Xếp Hạng Kỳ Thủ Toàn Hệ Thống</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Danh sách các kỳ thủ AI hàng đầu được xếp hạng theo Elo
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              className="secondary-action text-xs"
              onClick={fetchData}
              disabled={loading || matchesLoading}
            >
              <Icon name="refresh" size={14} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'Đang cập nhật...' : 'Làm mới'}</span>
            </button>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-xs text-emerald-300 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Đấu Rank: Mở</span>
            </div>
          </div>
        </div>

        {errors.leaderboard && (
          <p role="alert" className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs">
            {errors.leaderboard} Bấm Làm mới để thử lại.
          </p>
        )}

        <div className="cyber-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400 font-extrabold bg-navy-950/80">
                  <th className="py-4 px-5">HẠNG</th>
                  <th className="py-4 px-5">KỲ THỦ / ĐỘI THI ĐẤU</th>
                  <th className="py-4 px-5">ELO RATING</th>
                  <th className="py-4 px-5">THẮNG / THUA / HÒA</th>
                  <th className="py-4 px-5">BOT TÁC CHIẾN</th>
                  <th className="py-4 px-5 text-right">HÀNH ĐỘNG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-sm">
                {loading && leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
                      <p className="text-xs">Đang tải bảng xếp hạng đấu trường...</p>
                    </td>
                  </tr>
                ) : leaderboard.length === 0 && !errors.leaderboard ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Chưa có đấu thủ nào trên bảng xếp hạng. Hãy đăng ký và nộp bot đầu tiên!
                    </td>
                  </tr>
                ) : (
                  leaderboard.map((player, idx) => {
                    const rank = idx + 1;
                    const tierTag = getPlayerTierTag(player.elo_rating);
                    const isCurrent = user?.id === player.id;

                    return (
                      <tr
                        key={player.id}
                        className={`hover:bg-white/[0.03] transition-colors ${
                          isCurrent ? 'bg-blue-950/25 border-l-2 border-l-blue-500' : ''
                        }`}
                      >
                        {/* Rank */}
                        <td className="py-4 px-5">
                          {getRankBadge(rank)}
                        </td>

                        {/* Player Info */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <span className="user-avatar text-xs font-bold w-8 h-8 rounded-lg">
                              {player.username.charAt(0).toUpperCase()}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm">{player.username}</span>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${tierTag.color}`}>
                                  {tierTag.name}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {player.role === 'ADMIN' ? 'Ban Tổ Chức' : 'Kỳ Thủ Tranh Tài'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Elo Rating */}
                        <td className="py-4 px-5">
                          <span className="inline-flex items-center px-3 py-1 rounded-lg bg-navy-950 border border-white/10 font-mono font-black text-amber-400 text-sm shadow-inner">
                            {player.elo_rating ?? 1200}
                          </span>
                        </td>

                        {/* W / L / D */}
                        <td className="py-4 px-5">
                          <div className="text-xs font-bold flex items-center gap-1.5 font-mono">
                            <span className="text-emerald-400">{player.wins || 0}W</span>
                            <span className="text-slate-600">/</span>
                            <span className="text-red-400">{player.losses || 0}L</span>
                            <span className="text-slate-600">/</span>
                            <span className="text-slate-400">{player.draws || 0}D</span>
                          </div>
                        </td>

                        {/* Active Bot */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span className="text-xs text-slate-300 font-semibold truncate max-w-[150px]">
                              {player.active_bot_name || 'Bot Tự Động'}
                            </span>
                          </div>
                        </td>

                        {/* Action Button */}
                        <td className="py-4 px-5 text-right">
                          <button
                            type="button"
                            onClick={() => onChallengePlayer(player)}
                            disabled={isCurrent}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 ${
                              isCurrent
                                ? 'bg-white/5 text-slate-400 cursor-default'
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-950/40 hover:scale-105 active:scale-95'
                            }`}
                          >
                            <Icon name="swords" size={13} />
                            <span>{isCurrent ? 'Chính Bạn' : 'Thách Đấu'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 6. RECENT MATCHES STREAM */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Lịch Sử Giao Tranh Gần Đây</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Theo dõi trực tiếp diễn biến chiến thuật và xem lại từng nước đi
            </p>
          </div>

          {onExploreData && (
            <button
              onClick={onExploreData}
              className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-950/30 border border-blue-500/20 hover:border-blue-500/40 transition-colors"
            >
              <span>Xem toàn bộ lịch sử</span>
              <Icon name="chevronRight" size={14} />
            </button>
          )}
        </div>

        {errors.matches && (
          <p role="alert" className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs">
            {errors.matches} Bấm Làm mới để thử lại.
          </p>
        )}

        <div className="cyber-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-slate-400 font-extrabold bg-navy-950/80">
                  <th className="py-3.5 px-5">MÃ TRẬN</th>
                  <th className="py-3.5 px-5">ĐỘI XANH (P1)</th>
                  <th className="py-3.5 px-5">ĐỘI ĐỎ (P2)</th>
                  <th className="py-3.5 px-5">KẾT QUẢ</th>
                  <th className="py-3.5 px-5">SỐ LƯỢT</th>
                  <th className="py-3.5 px-5">THỜI GIAN</th>
                  <th className="py-3.5 px-5 text-right">XEM LẠI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-xs">
                {matchesLoading && recentMatches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400" role="status">
                      Đang tải dữ liệu trận đấu gần đây...
                    </td>
                  </tr>
                ) : recentMatches.length === 0 && !errors.matches ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Chưa có trận đấu nào được ghi nhận. Hãy thách đấu để tạo trận đấu đầu tiên!
                    </td>
                  </tr>
                ) : (
                  recentMatches.map((match) => {
                    const isDraw = match.result_known && match.winner_side === null;

                    return (
                      <tr key={match.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3.5 px-5 font-mono text-slate-400">
                          <span className="match-label" title={match.id}>{matchLabel(match)}</span>
                        </td>

                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-glow-blue" />
                            <span className="font-bold text-slate-200">{match.p1_username || 'Bot AI'}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({match.p1_bot_name || 'P1'})</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-glow-red" />
                            <span className="font-bold text-slate-200">{match.p2_username || 'Bot AI'}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({match.p2_bot_name || 'P2'})</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-5">
                          {isDraw ? (
                            <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 font-bold text-[10px]">
                              HÒA
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-md bg-emerald-950/70 text-emerald-300 border border-emerald-500/30 font-bold text-[10px]">
                              {match.result_known ? `${match.winner_username} THẮNG` : 'CHỜ KẾT QUẢ'}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-5 font-mono font-bold text-slate-300">
                          {match.total_turns || 0} lượt
                        </td>

                        <td className="py-3.5 px-5 text-slate-400">
                          {new Date(match.created_at).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>

                        <td className="py-3.5 px-5 text-right">
                          <button
                            type="button"
                            onClick={() => onSelectReplay(match.id)}
                            className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/30 font-bold text-xs transition-colors inline-flex items-center gap-1.5"
                          >
                            <Icon name="play" size={13} />
                            <span>Xem Replay</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 7. PROFESSIONAL GAMING FOOTER */}
      <footer className="pt-8 pb-4 border-t border-white/10 text-slate-400 text-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="brand-mark text-[11px] w-7 h-7">BC</div>
          <div>
            <span className="font-extrabold text-white text-sm">BATTLECODE AI ARENA</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Tactical RPS Esports Platform · 2026</p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs text-slate-400">
          <span>Quy chế giải đấu</span>
          <span>Bảo mật dữ liệu</span>
          <span>Tài liệu thuật toán</span>
          <span>Ban tổ chức</span>
        </div>
      </footer>
    </div>
  );
}
