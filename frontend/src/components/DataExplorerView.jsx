import { matchLabel, matchesMatchNumber } from '../lib/matchLabel';
import React, { useState, useEffect } from 'react';

export default function DataExplorerView({ onSelectReplay }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/game/recent-matches?limit=100');
      if (res.ok) {
        const d = await res.json();
        setMatches(d.data || []);
      }
    } catch (e) {
      console.warn('Match history fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredMatches = matches.filter((m) => {
    const q = searchTerm.toLowerCase();
    return (
      matchesMatchNumber(m,q) ||
      (m.p1_username && m.p1_username.toLowerCase().includes(q)) ||
      (m.p2_username && m.p2_username.toLowerCase().includes(q)) ||
      (m.p1_bot_name && m.p1_bot_name.toLowerCase().includes(q)) ||
      (m.p2_bot_name && m.p2_bot_name.toLowerCase().includes(q)) ||
      (m.winner_username && m.winner_username.toLowerCase().includes(q)) ||
      (m.id && m.id.toLowerCase().includes(q))
    );
  });

  return (
    <div className="view-shell animate-fadeIn">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-black text-white tracking-wide flex items-center gap-2">
            <span>Lịch sử trận đấu</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Tìm kiếm, xem lại và phân tích dữ liệu của từng trận đấu.
          </p>
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Tìm theo kỳ thủ, bot hoặc mã trận..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-[#0e1322] border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500 shadow-inner"
          />
        </div>
      </div>

      {/* Matches Table */}
      <div className="rounded-2xl border border-white/5 bg-[#0e1322]/80 backdrop-blur-md overflow-hidden shadow-xl shadow-black/30">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-slate-400 font-bold bg-[#090d18]/70">
                <th className="py-3.5 px-5">MÃ TRẬN</th>
                <th className="py-3.5 px-5">XANH (P1)</th>
                <th className="py-3.5 px-5">ĐỎ (P2)</th>
                <th className="py-3.5 px-5">KẾT QUẢ</th>
                <th className="py-3.5 px-5">LÝ DO THẮNG</th>
                <th className="py-3.5 px-5">SỐ LƯỢT</th>
                <th className="py-3.5 px-5">THỜI LƯỢNG</th>
                <th className="py-3.5 px-5 text-right">THAO TÁC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <p>Đang tải dữ liệu trận đấu...</p>
                  </td>
                </tr>
              ) : filteredMatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Không tìm thấy trận đấu nào phù hợp với bộ lọc tìm kiếm.
                  </td>
                </tr>
              ) : (
                filteredMatches.map((match) => {
                  const isDraw = match.result_known && match.winner_side === null;

                  return (
                    <tr key={match.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-5 font-mono text-slate-400">
                        <span className="match-label" title={match.id}>{matchLabel(match)}</span>
                      </td>

                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          <span className="font-bold text-slate-200">{match.p1_username || 'Bot AI'}</span>
                          <span className="text-[10px] text-slate-500">({match.p1_bot_name || 'Gốc'})</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          <span className="font-bold text-slate-200">{match.p2_username || 'Bot AI'}</span>
                          <span className="text-[10px] text-slate-500">({match.p2_bot_name || 'Gốc'})</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-5">
                        {isDraw ? (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-[10px]">
                            HÒA
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/20 font-bold text-[10px]">
                            {match.result_known ? `${match.winner_username} THẮNG` : 'CHƯA RÕ KẾT QUẢ'}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-5">
                        {match.win_reason === 'FLAG_CAPTURE' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold text-[10px]">
                            CƯỚP CỜ
                          </span>
                        ) : match.win_reason === 'ELIMINATION' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-bold text-[10px]">
                            QUÉT SẠCH
                          </span>
                        ) : match.win_reason === 'MAX_TURNS_REACHED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-[10px]">
                            ⏳ HẾT LƯỢT
                          </span>
                        ) : match.win_reason === 'INFINITE_LOOP' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 font-bold text-[10px]">
                            LẶP VÔ HẠN
                          </span>
                        ) : match.win_reason === 'TIMEOUT' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300 font-bold text-[10px]">
                            ⏱️ QUÁ GIỜ
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px]">
                            {match.win_reason || 'CHECKMATE'}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-5 font-mono text-slate-300">
                        {match.total_turns || 0}
                      </td>

                      <td className="py-3.5 px-5 font-mono text-slate-400">
                        {match.duration_ms ? `${(match.duration_ms / 1000).toFixed(1)}s` : '—'}
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => onSelectReplay(match.id)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white border border-indigo-500/30 font-semibold transition-colors"
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
  );
}
