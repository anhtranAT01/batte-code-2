import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LeaderboardView({ onSelectReplay, onChallengePlayer, onExploreData }) {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [lbRes, rmRes] = await Promise.all([
        fetch('/api/game/leaderboard?limit=25'),
        fetch('/api/game/recent-matches?limit=10'),
      ]);

      if (lbRes.ok) {
        const lbData = await lbRes.json();
        setLeaderboard(lbData.data || []);
      }
      if (rmRes.ok) {
        const rmData = await rmRes.json();
        setRecentMatches(rmData.data || []);
      }
    } catch (err) {
      console.error('[Leaderboard] Fetch error:', err);
    } finally {
      setLoading(false);
    }
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
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-900 font-black flex items-center justify-center text-xs shadow-md shadow-amber-500/30 ring-2 ring-amber-400/30">
          1
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-slate-300 to-slate-100 text-slate-900 font-black flex items-center justify-center text-xs shadow-md shadow-slate-300/30 ring-2 ring-slate-300/30">
          2
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-700 to-orange-500 text-white font-black flex items-center justify-center text-xs shadow-md shadow-orange-500/30 ring-2 ring-orange-500/30">
          3
        </div>
      );
    }
    return (
      <div className="w-7 h-7 rounded-full bg-slate-800/80 text-slate-400 font-semibold flex items-center justify-center text-xs border border-white/5">
        {rank}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-wide">
            Bảng xếp hạng & Đấu trường FFA (Leaderboard)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Xếp hạng thuật toán 9x9 Rock · Paper · Scissors Chess theo Elo
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-xs text-emerald-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Cổng FFA: Mở</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/40 border border-amber-500/20 text-xs text-amber-300 font-medium">
            <span>Hệ số ngày: x1.5</span>
          </div>
        </div>
      </div>

      {/* 5 Rank Tier Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {tiers.map((t, idx) => (
          <div
            key={idx}
            className={`p-3.5 rounded-2xl bg-gradient-to-br ${t.bg} border ${t.border} backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${t.iconBg} flex items-center justify-center text-lg shadow-inner`}>
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

      {/* Main Leaderboard Table */}
      <div className="rounded-2xl border border-white/5 bg-[#0e1322]/80 backdrop-blur-md overflow-hidden shadow-xl shadow-black/30">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-slate-400 font-bold bg-[#090d18]/70">
                <th className="py-4 px-5">HẠNG</th>
                <th className="py-4 px-5">NGƯỜI CHƠI</th>
                <th className="py-4 px-5">ELO RATING</th>
                <th className="py-4 px-5">THẮNG / THUA / HÒA</th>
                <th className="py-4 px-5">BOT HOẠT ĐỘNG</th>
                <th className="py-4 px-5 text-right">HÀNH ĐỘNG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <p className="text-xs">Đang tải bảng xếp hạng FFA...</p>
                  </td>
                </tr>
              ) : leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Chưa có người chơi nào trên bảng xếp hạng.
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
                      className={`hover:bg-white/[0.02] transition-colors ${
                        isCurrent ? 'bg-indigo-950/20' : ''
                      }`}
                    >
                      {/* Rank */}
                      <td className="py-4 px-5">
                        {getRankBadge(rank)}
                      </td>

                      {/* Player Info */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 p-0.5 shadow-md shadow-indigo-950/50">
                            <div className="w-full h-full bg-[#11162a] rounded-full flex items-center justify-center font-bold text-xs text-white uppercase">
                              {player.username.charAt(0)}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">{player.username}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${tierTag.color}`}>
                                {tierTag.name}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {player.role === 'ADMIN' ? 'Ban tổ chức' : 'Kỳ thủ nhập môn'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Elo Rating */}
                      <td className="py-4 px-5">
                        <span className="inline-flex items-center px-3 py-1 rounded-lg bg-[#090d18] border border-white/5 font-mono font-bold text-amber-400 text-sm shadow-inner">
                          {player.elo_rating || 1200}
                        </span>
                      </td>

                      {/* W / L / D */}
                      <td className="py-4 px-5">
                        <div className="text-xs font-semibold flex items-center gap-1.5 font-mono">
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
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          <span className="text-xs text-slate-300 font-medium">
                            {player.active_bot_name || 'Sẵn sàng'}
                          </span>
                        </div>
                      </td>

                      {/* Action Button */}
                      <td className="py-4 px-5 text-right">
                        <button
                          onClick={() => onChallengePlayer(player)}
                          className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-xs shadow-md shadow-indigo-950/40 transition-all hover:scale-105 active:scale-95 inline-flex items-center gap-1.5"
                        >
                          <span>Thách đấu</span>
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

      {/* Recent Matches Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Trận đấu gần đây (Recent Matches)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Bất kỳ ai cũng có thể bấm vào xem lại từng nước đi trực tiếp
            </p>
          </div>

          <button
            onClick={onExploreData}
            className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 self-start sm:self-auto px-3 py-1.5 rounded-lg bg-indigo-950/30 border border-indigo-500/20 hover:border-indigo-500/40 transition-colors"
          >
            <span>Khám phá toàn bộ Dữ liệu (Data Explorer)</span>
            <span>→</span>
          </button>
        </div>

        {/* Recent Matches Table */}
        <div className="rounded-2xl border border-white/5 bg-[#0e1322]/80 backdrop-blur-md overflow-hidden shadow-xl shadow-black/30">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-slate-400 font-bold bg-[#090d18]/70">
                  <th className="py-3.5 px-5">TRẬN</th>
                  <th className="py-3.5 px-5">NGƯỜI CHƠI 1 (ĐỎ)</th>
                  <th className="py-3.5 px-5">NGƯỜI CHƠI 2 (XANH)</th>
                  <th className="py-3.5 px-5">KẾT QUẢ</th>
                  <th className="py-3.5 px-5">SỐ LƯỢT</th>
                  <th className="py-3.5 px-5">THỜI GIAN</th>
                  <th className="py-3.5 px-5 text-right">HÀNH ĐỘNG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-xs">
                {recentMatches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      Chưa có trận đấu nào được diễn ra. Hãy thách đấu để tạo trận đấu đầu tiên!
                    </td>
                  </tr>
                ) : (
                  recentMatches.map((match) => {
                    const isP1Win = match.winner_username === match.p1_username;
                    const isDraw = !match.winner_username;

                    return (
                      <tr key={match.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-5 font-mono text-slate-500">
                          #{match.id.substring(0, 8)}
                        </td>

                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-400"></span>
                            <span className="font-semibold text-slate-200">{match.p1_username || 'Bot AI'}</span>
                            <span className="text-[10px] text-slate-500">({match.p1_bot_name || 'Mặc định'})</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                            <span className="font-semibold text-slate-200">{match.p2_username || 'Bot AI'}</span>
                            <span className="text-[10px] text-slate-500">({match.p2_bot_name || 'Mặc định'})</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-5">
                          {isDraw ? (
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold text-[10px]">
                              HÒA
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/20 font-semibold text-[10px]">
                              {match.winner_username} THẮNG
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-5 font-mono text-slate-400">
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
                            onClick={() => onSelectReplay(match.id)}
                            className="px-3 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white border border-indigo-500/30 font-medium transition-colors"
                          >
                            Xem replay
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
      </div>
    </div>
  );
}
