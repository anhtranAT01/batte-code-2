import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../lib/api';

export default function TournamentBracketsView({ onSelectReplay }) {
  const { user, getAuthHeaders } = useAuth();

  // 2 Core Tournament Modes: 'ALL_IN' | 'BRANCHES'
  const [tournamentMode, setTournamentMode] = useState('ALL_IN');

  const [tournaments, setTournaments] = useState([]);
  const [selectedTourneyId, setSelectedTourneyId] = useState(null);
  const [standingsData, setStandingsData] = useState(null);
  const [myBots, setMyBots] = useState([]);
  const [selectedBotId, setSelectedBotId] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);

  // Admin schedule state
  const [scheduleTimeInput, setScheduleTimeInput] = useState('');
  const [countdown, setCountdown] = useState(null);

  // Admin Bracket Assignment Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignMatchId, setAssignMatchId] = useState('');
  const [assignSlot, setAssignSlot] = useState('p1');
  const [assignStudentName, setAssignStudentName] = useState('');
  const [assignBotName, setAssignBotName] = useState('');

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'TEACHER';

  // Load tournaments & my bots
  useEffect(() => {
    fetchTournaments();
    if (user) {
      fetch('/api/bots/my-bots', { headers: getAuthHeaders() })
        .then((res) => (res.ok ? res.json() : { data: [] }))
        .then((d) => {
          const bots = d.data || [];
          setMyBots(bots);
          const active = bots.find((b) => b.is_active);
          if (active) setSelectedBotId(active.id);
          else if (bots.length > 0) setSelectedBotId(bots[0].id);
        })
        .catch(console.warn);
    }
  }, [user]);

  // Load standings on tournament change
  useEffect(() => {
    if (selectedTourneyId) {
      fetchStandings(selectedTourneyId);
    }
  }, [selectedTourneyId]);

  // Filter tournaments matching current mode
  const currentModeTournaments = tournaments.filter((t) => {
    const mode = t.mode || (t.settings_json?.mode) || (t.brackets_json?.length > 0 ? 'BRANCHES' : 'ALL_IN');
    return mode === tournamentMode;
  });

  // Keep selectedTourneyId synced with mode
  useEffect(() => {
    if (currentModeTournaments.length > 0) {
      const match = currentModeTournaments.find((t) => t.id === selectedTourneyId);
      if (!match) {
        setSelectedTourneyId(currentModeTournaments[0].id);
      }
    }
  }, [tournamentMode, tournaments]);

  // Countdown timer
  useEffect(() => {
    if (!standingsData?.tournament?.scheduledStartAt) {
      setCountdown(null);
      return;
    }

    const target = new Date(standingsData.tournament.scheduledStartAt).getTime();
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
        setCountdown('Đã đến giờ bắt đầu!');
        clearInterval(interval);
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const mins = Math.floor((diff / (1000 * 60)) % 60);
        const secs = Math.floor((diff / 1000) % 60);
        setCountdown(
          `${days > 0 ? `${days} ngày ` : ''}${hours.toString().padStart(2, '0')}:${mins
            .toString()
            .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [standingsData?.tournament?.scheduledStartAt]);

  const fetchTournaments = async () => {
    try {
      const res = await fetch('/api/tournaments');
      if (res.ok) {
        const data = await res.json();
        const list = data.data || [];
        setTournaments(list);
        if (list.length > 0 && !selectedTourneyId) {
          setSelectedTourneyId(list[0].id);
        }
      }
    } catch (err) {
      console.warn('[Tournament] List fetch error:', err);
    }
  };

  const fetchStandings = async (id) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${id}/standings`);
      if (res.ok) {
        const data = await res.json();
        setStandingsData(data.data);
      }
    } catch (err) {
      console.warn('[Tournament] Standings fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Register student bot into current tournament
  const handleRegister = async () => {
    if (!user) {
      alert('Vui lòng đăng nhập để đăng ký giải đấu!');
      return;
    }
    if (!selectedTourneyId) return;

    setLoading(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/tournaments/${selectedTourneyId}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ botId: selectedBotId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Đăng ký thất bại');
      setActionMsg({ type: 'success', text: data.message });
      fetchStandings(selectedTourneyId);
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Admin Batch Grade
  const handleBatchGradeRound = async () => {
    if (!selectedTourneyId) return;
    if (!confirm('Khởi chạy máy chấm tự động toàn bộ thí sinh trong giải đấu này?')) return;
    setLoading(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/admin/tournaments/${selectedTourneyId}/batch-grade`, {
        method: 'POST',
        headers: { ...getAuthHeaders() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Chấm điểm thất bại');
      setActionMsg({ type: 'success', text: data.message });
      fetchStandings(selectedTourneyId);
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Admin Run Bracket Matches
  const handleRunBracketMatches = async () => {
    if (!selectedTourneyId) return;
    if (!confirm('Tự động giao đấu và tính kết quả cho toàn bộ các cặp đấu trong nhánh?')) return;
    setLoading(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/admin/tournaments/${selectedTourneyId}/brackets/run-all`, {
        method: 'POST',
        headers: { ...getAuthHeaders() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Mô phỏng nhánh thất bại');
      setActionMsg({ type: 'success', text: data.message });
      fetchStandings(selectedTourneyId);
      fetchTournaments();
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Admin Assign Student into Bracket Slot
  const handleSaveBracketAssignment = async (e) => {
    e.preventDefault();
    if (!assignMatchId || !assignStudentName.trim()) return;
    try {
      const res = await fetch(`/api/admin/tournaments/${selectedTourneyId}/brackets/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          bracketMatchId: assignMatchId,
          slot: assignSlot,
          studentName: assignStudentName.trim(),
          botName: assignBotName.trim() || 'Custom Bot',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setActionMsg({ type: 'success', text: data.message });
      setAssignModalOpen(false);
      fetchStandings(selectedTourneyId);
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  // Admin Update Schedule
  const handleUpdateSchedule = async (e) => {
    e.preventDefault();
    if (!scheduleTimeInput || !selectedTourneyId) return;
    try {
      const res = await fetch(`/api/tournaments/${selectedTourneyId}/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ scheduledStartAt: new Date(scheduleTimeInput).toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setActionMsg({ type: 'success', text: data.message });
      fetchStandings(selectedTourneyId);
      setScheduleTimeInput('');
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  const tourney = standingsData?.tournament;
  const rawStandings = standingsData?.standings || [];
  const brackets = standingsData?.tournament?.brackets || [];

  return (
    <div className="space-y-8 animate-fadeIn max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-wide flex items-center gap-2">
            <span>⚔️</span>
            <span>Đấu Trường Giải Đấu Sinh Viên Đại Học (University Arena)</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Nền tảng thi đấu cờ thuật toán Kéo-Búa-Bao cướp cờ quy mô toàn trường và các cúp nhánh theo Khoa/Viện AI
          </p>
        </div>

        {/* Export & Actions */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {selectedTourneyId && (
            <>
              <a
                href={apiUrl(`/api/tournaments/${selectedTourneyId}/export/excel`)}
                download
                className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-white border border-emerald-500/30 font-semibold text-xs transition-colors flex items-center gap-1.5"
              >
                <span>📥</span>
                <span>Xuất Bảng Điểm Excel (.xlsx)</span>
              </a>
              <a
                href={apiUrl(`/api/tournaments/${selectedTourneyId}/export/csv`)}
                download
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-white/5 transition-colors flex items-center gap-1.5"
              >
                <span>📄</span>
                <span>CSV</span>
              </a>
            </>
          )}

          {isAdmin && tournamentMode === 'ALL_IN' && (
            <button
              onClick={handleBatchGradeRound}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
            >
              <span>⚡</span>
              <span>Chấm Điểm Toàn Bộ Sinh Viên</span>
            </button>
          )}

          {isAdmin && tournamentMode === 'BRANCHES' && (
            <button
              onClick={handleRunBracketMatches}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
            >
              <span>⚡</span>
              <span>Tự Động Chạy Toàn Bộ Nhánh Đấu</span>
            </button>
          )}
        </div>
      </div>

      {/* TWO PROMINENT MAIN TOURNAMENT MODES (USER REQUEST) */}
      <div className="p-1.5 rounded-2xl bg-[#090d18] border border-white/10 flex flex-col sm:flex-row gap-2 shadow-2xl">
        <button
          onClick={() => setTournamentMode('ALL_IN')}
          className={`flex-1 py-4 px-6 rounded-xl font-black text-sm flex items-center justify-center gap-3 transition-all ${
            tournamentMode === 'ALL_IN'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-600/30 ring-1 ring-white/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <span className="text-2xl">🌐</span>
          <div className="text-left">
            <div className="font-extrabold uppercase tracking-wide">Mục 1: Thi Đấu Toàn Thể (All-in Grand Arena)</div>
            <div className="text-[11px] font-normal text-indigo-200 mt-0.5 opacity-90">
              Chế độ mở cho toàn thể sinh viên các Khoa. Nộp bot tự động chấm điểm và xếp hạng trên bảng điểm chung.
            </div>
          </div>
        </button>

        <button
          onClick={() => setTournamentMode('BRANCHES')}
          className={`flex-1 py-4 px-6 rounded-xl font-black text-sm flex items-center justify-center gap-3 transition-all ${
            tournamentMode === 'BRANCHES'
              ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-xl shadow-amber-600/30 ring-1 ring-white/20'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <span className="text-2xl">🏆</span>
          <div className="text-left">
            <div className="font-extrabold uppercase tracking-wide">Mục 2: Các Giải Đấu Riêng Lẻ & Nhánh Đấu (Branch Tournaments)</div>
            <div className="text-[11px] font-normal text-amber-200 mt-0.5 opacity-90">
              Đăng ký tham gia vào từng nhánh cụ thể (Tứ kết - Bán kết - Chung kết) theo Khoa, Lớp, hoặc Cup AI.
            </div>
          </div>
        </button>
      </div>

      {/* Action Notification Alert */}
      {actionMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            actionMsg.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-red-950/40 border-red-500/30 text-red-300'
          }`}
        >
          <span>{actionMsg.text}</span>
          <button onClick={() => setActionMsg(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Main Tournament Selector & Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tournament Selector */}
        <div className="p-5 rounded-2xl bg-[#0e1322]/80 border border-white/5 backdrop-blur-md space-y-3">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
            {tournamentMode === 'ALL_IN' ? 'Chọn Giải Đấu Toàn Thể' : 'Chọn Giải Đấu Nhánh Riêng Lẻ'}
          </label>
          <select
            value={selectedTourneyId || ''}
            onChange={(e) => setSelectedTourneyId(e.target.value)}
            className="w-full py-2.5 px-3 rounded-xl bg-[#090d18] border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
          >
            {currentModeTournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.status})
              </option>
            ))}
          </select>

          {tourney && (
            <div className="text-xs text-slate-400 space-y-1.5 pt-2 border-t border-white/5">
              <div className="flex justify-between">
                <span>Thể thức:</span>
                <span className="font-bold text-white uppercase">{tourney.mode || tournamentMode}</span>
              </div>
              <div className="flex justify-between">
                <span>Khoa / Đơn vị:</span>
                <span className="text-slate-300">{tourney.settings_json?.faculty || 'Khoa CNTT - Viện AI'}</span>
              </div>
              <div className="flex justify-between">
                <span>Quy mô tối đa:</span>
                <span className="font-mono text-indigo-400 font-bold">{tourney.max_participants} sinh viên</span>
              </div>
            </div>
          )}
        </div>

        {/* Schedule & Countdown */}
        <div className="p-5 rounded-2xl bg-[#0e1322]/80 border border-white/5 backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Thời Gian Khởi Tranh
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                tourney?.status === 'ONGOING' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
              }`}>
                {tourney?.status || 'UPCOMING'}
              </span>
            </div>

            <div className="mt-3">
              {countdown ? (
                <div className="font-mono text-2xl font-black text-amber-400 tracking-wider">
                  ⏱️ {countdown}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">
                  Chưa thiết lập thời gian bắt đầu
                </div>
              )}
              {tourney?.scheduledStartAt && (
                <div className="text-[11px] text-slate-400 mt-1">
                  Bắt đầu: {new Date(tourney.scheduledStartAt).toLocaleString('vi-VN')}
                </div>
              )}
            </div>
          </div>

          {/* Admin Schedule Picker */}
          {isAdmin && (
            <form onSubmit={handleUpdateSchedule} className="mt-3 pt-3 border-t border-white/5 flex gap-2">
              <input
                type="datetime-local"
                value={scheduleTimeInput}
                onChange={(e) => setScheduleTimeInput(e.target.value)}
                className="flex-1 py-1 px-2 rounded-lg bg-[#090d18] border border-white/10 text-white text-[11px] focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors"
              >
                Lưu Giờ
              </button>
            </form>
          )}
        </div>

        {/* Student Bot Registration Card */}
        <div className="p-5 rounded-2xl bg-[#0e1322]/80 border border-white/5 backdrop-blur-md flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              {tournamentMode === 'ALL_IN' ? 'Đăng Ký Làm Bài / Nộp Bot' : 'Đăng Ký Vào Nhánh Đấu'}
            </span>
            <p className="text-xs text-slate-300 mt-1">
              Chọn Bot của bản thân để hệ thống tự động ghi danh và giao tranh:
            </p>

            <div className="mt-2.5">
              <select
                value={selectedBotId}
                onChange={(e) => setSelectedBotId(e.target.value)}
                className="w-full py-2 px-3 rounded-xl bg-[#090d18] border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
              >
                {myBots.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.tactic || 'Cướp Cờ'}) {b.is_active ? '⭐' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleRegister}
            disabled={loading || !selectedTourneyId}
            className="w-full mt-3 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
          >
            <span>📝</span>
            <span>{tournamentMode === 'ALL_IN' ? 'Xác Nhận Nộp Bài / Tham Gia' : 'Ghi Danh Vào Nhánh Đấu'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MỤC 1: BẢNG XẾP HẠNG & ĐIỂM SỐ THI ĐẤU TOÀN THỂ (ALL_IN) */}
      {/* ========================================================= */}
      {tournamentMode === 'ALL_IN' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <span>📊</span>
                <span>Bảng Điểm & Xếp Hạng Sinh Viên Toàn Thể ({rawStandings.length} Thí Sinh)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Điểm số được tính tự động từ các ván đấu cướp cờ và đối kháng thuật toán giữa các sinh viên
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-[#0e1322]/80 border border-white/5 overflow-hidden backdrop-blur-md shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#090d18] text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/5">
                  <tr>
                    <th className="py-3.5 px-5">HẠNG</th>
                    <th className="py-3.5 px-5">SINH VIÊN</th>
                    <th className="py-3.5 px-5">CHIẾN BINH BOT</th>
                    <th className="py-3.5 px-5 text-center">ĐIỂM SỐ</th>
                    <th className="py-3.5 px-5 text-center">THẮNG - THUA</th>
                    <th className="py-3.5 px-5 text-center">ELO</th>
                    <th className="py-3.5 px-5 text-center">TRẠNG THÁI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-medium">
                  {rawStandings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 italic">
                        Chưa có sinh viên nào đăng ký tham gia giải đấu này.
                      </td>
                    </tr>
                  ) : (
                    rawStandings.map((p, idx) => (
                      <tr key={p.id || idx} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-5 font-bold">
                          {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `#${idx + 1}`}
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="font-bold text-white">{p.username}</div>
                          <div className="text-[10px] text-slate-400">Sinh Viên Đại Học</div>
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="font-mono text-indigo-300 font-semibold">{p.botName || 'Custom Bot'}</span>
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <span className="font-mono font-black text-amber-400 text-sm">{p.points || 0} pts</span>
                        </td>
                        <td className="py-3.5 px-5 text-center font-mono">
                          <span className="text-emerald-400">{p.wins || 0}W</span> - <span className="text-red-400">{p.losses || 0}L</span>
                        </td>
                        <td className="py-3.5 px-5 text-center font-mono font-bold text-sky-400">
                          {p.elo || 1200}
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                            Đã Chấm Điểm
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MỤC 2: SƠ ĐỒ NHÁNH THI ĐẤU RIÊNG LẺ (BRANCH & BRACKET TOURNAMENTS) */}
      {/* ============================================================== */}
      {tournamentMode === 'BRANCHES' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <span>🏆</span>
                <span>Sơ Đồ Phân Nhánh Thi Đấu Loại Trực Tiếp (Knockout Brackets)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Các cặp đấu sinh viên theo từng vòng: Tứ Kết (Quarterfinals) ➔ Bán Kết (Semifinals) ➔ Chung Kết Cúp Vô Địch
              </p>
            </div>

            {isAdmin && (
              <button
                onClick={() => setAssignModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-colors flex items-center gap-1.5 self-start sm:self-auto"
              >
                <span>⚙️</span>
                <span>Admin Xếp Sinh Viên Vào Nhánh</span>
              </button>
            )}
          </div>

          {/* Brackets Visual Tree */}
          <div className="p-6 rounded-2xl bg-[#0e1322]/80 border border-white/5 backdrop-blur-md overflow-x-auto shadow-2xl">
            <div className="min-w-[850px] grid grid-cols-3 gap-8">
              {/* ROUND 1: TỨ KẾT */}
              <div className="space-y-4">
                <div className="text-center pb-2 border-b border-white/5">
                  <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">
                    Vòng Tứ Kết (QF)
                  </span>
                </div>
                {brackets.filter(b => b.round === 1).map((m) => (
                  <div key={m.id} className="p-3 rounded-xl bg-[#090d18] border border-white/10 space-y-2 relative group hover:border-indigo-500/50 transition-all">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                      <span>{m.title}</span>
                      <span className={`px-1.5 py-0.5 rounded ${m.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-slate-400'}`}>
                        {m.status}
                      </span>
                    </div>

                    {/* Player 1 */}
                    <div className={`p-2 rounded-lg flex items-center justify-between text-xs ${m.winner === m.p1?.name ? 'bg-emerald-950/40 text-emerald-300 font-bold border border-emerald-500/30' : 'bg-[#0c101d] text-slate-300'}`}>
                      <div>
                        <div className="truncate max-w-[140px]">{m.p1?.name || 'TBD'}</div>
                        <div className="text-[10px] text-slate-500 truncate">{m.p1?.bot || ''}</div>
                      </div>
                      <span className="font-mono font-bold text-sm">{m.p1?.score !== null ? m.p1?.score : '-'}</span>
                    </div>

                    {/* Player 2 */}
                    <div className={`p-2 rounded-lg flex items-center justify-between text-xs ${m.winner === m.p2?.name ? 'bg-emerald-950/40 text-emerald-300 font-bold border border-emerald-500/30' : 'bg-[#0c101d] text-slate-300'}`}>
                      <div>
                        <div className="truncate max-w-[140px]">{m.p2?.name || 'TBD'}</div>
                        <div className="text-[10px] text-slate-500 truncate">{m.p2?.bot || ''}</div>
                      </div>
                      <span className="font-mono font-bold text-sm">{m.p2?.score !== null ? m.p2?.score : '-'}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* ROUND 2: BÁN KẾT */}
              <div className="space-y-4 flex flex-col justify-around">
                <div className="text-center pb-2 border-b border-white/5">
                  <span className="text-xs font-black text-purple-400 uppercase tracking-widest">
                    Vòng Bán Kết (SF)
                  </span>
                </div>
                {brackets.filter(b => b.round === 2).map((m) => (
                  <div key={m.id} className="p-3 rounded-xl bg-[#090d18] border border-white/10 space-y-2 relative group hover:border-purple-500/50 transition-all">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                      <span>{m.title}</span>
                      <span className={`px-1.5 py-0.5 rounded ${m.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-slate-400'}`}>
                        {m.status}
                      </span>
                    </div>

                    <div className={`p-2 rounded-lg flex items-center justify-between text-xs ${m.winner === m.p1?.name ? 'bg-emerald-950/40 text-emerald-300 font-bold border border-emerald-500/30' : 'bg-[#0c101d] text-slate-300'}`}>
                      <div>
                        <div className="truncate max-w-[140px]">{m.p1?.name || 'Thắng QF'}</div>
                        <div className="text-[10px] text-slate-500 truncate">{m.p1?.bot || ''}</div>
                      </div>
                      <span className="font-mono font-bold text-sm">{m.p1?.score !== null ? m.p1?.score : '-'}</span>
                    </div>

                    <div className={`p-2 rounded-lg flex items-center justify-between text-xs ${m.winner === m.p2?.name ? 'bg-emerald-950/40 text-emerald-300 font-bold border border-emerald-500/30' : 'bg-[#0c101d] text-slate-300'}`}>
                      <div>
                        <div className="truncate max-w-[140px]">{m.p2?.name || 'Thắng QF'}</div>
                        <div className="text-[10px] text-slate-500 truncate">{m.p2?.bot || ''}</div>
                      </div>
                      <span className="font-mono font-bold text-sm">{m.p2?.score !== null ? m.p2?.score : '-'}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* ROUND 3: CHUNG KẾT CÚP */}
              <div className="space-y-4 flex flex-col justify-center">
                <div className="text-center pb-2 border-b border-white/5">
                  <span className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
                    <span>👑</span>
                    <span>Chung Kết Tranh Cúp</span>
                  </span>
                </div>
                {brackets.filter(b => b.round === 3).map((m) => (
                  <div key={m.id} className="p-4 rounded-xl bg-gradient-to-b from-[#151c33] to-[#090d18] border-2 border-amber-500/50 space-y-3 shadow-2xl shadow-amber-500/10">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                      <span>🏆 {m.title}</span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]">
                        {m.status}
                      </span>
                    </div>

                    <div className={`p-2.5 rounded-lg flex items-center justify-between text-xs ${m.winner === m.p1?.name ? 'bg-emerald-950/40 text-emerald-300 font-bold border border-emerald-500/30' : 'bg-[#0c101d] text-slate-300'}`}>
                      <div>
                        <div className="font-bold">{m.p1?.name || 'Thắng Bán Kết 1'}</div>
                        <div className="text-[10px] text-slate-400">{m.p1?.bot || ''}</div>
                      </div>
                      <span className="font-mono font-bold text-base">{m.p1?.score !== null ? m.p1?.score : '-'}</span>
                    </div>

                    <div className={`p-2.5 rounded-lg flex items-center justify-between text-xs ${m.winner === m.p2?.name ? 'bg-emerald-950/40 text-emerald-300 font-bold border border-emerald-500/30' : 'bg-[#0c101d] text-slate-300'}`}>
                      <div>
                        <div className="font-bold">{m.p2?.name || 'Thắng Bán Kết 2'}</div>
                        <div className="text-[10px] text-slate-400">{m.p2?.bot || ''}</div>
                      </div>
                      <span className="font-mono font-bold text-base">{m.p2?.score !== null ? m.p2?.score : '-'}</span>
                    </div>

                    {m.winner && (
                      <div className="p-2.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-center">
                        <div className="text-[10px] text-amber-300 uppercase font-black tracking-wider">
                          Quán Quân Cúp Vô Địch
                        </div>
                        <div className="text-sm font-black text-white mt-0.5">
                          🎉 {m.winner}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Assign Bracket Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#0e1322] border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-white text-base">Xếp Sinh Viên Vào Nhánh Đấu</h3>
              <button onClick={() => setAssignModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveBracketAssignment} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Chọn Trận Đấu Trong Nhánh:</label>
                <select
                  value={assignMatchId}
                  onChange={(e) => setAssignMatchId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#090d18] border border-white/10 text-white"
                  required
                >
                  <option value="">-- Chọn Trận Đấu --</option>
                  {brackets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} (Vòng {b.round})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Chọn Vị Trí (Slot):</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAssignSlot('p1')}
                    className={`py-2 rounded-xl font-bold border transition-all ${assignSlot === 'p1' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white/5 text-slate-400 border-white/5'}`}
                  >
                    Vị Trí 1 (P1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignSlot('p2')}
                    className={`py-2 rounded-xl font-bold border transition-all ${assignSlot === 'p2' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white/5 text-slate-400 border-white/5'}`}
                  >
                    Vị Trí 2 (P2)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Tên Sinh Viên / Thí Sinh:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: SV Nguyễn Văn A (K21)"
                  value={assignStudentName}
                  onChange={(e) => setAssignStudentName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#090d18] border border-white/10 text-white"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Tên Bot Python:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: A* Flag Rusher v2"
                  value={assignBotName}
                  onChange={(e) => setAssignBotName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#090d18] border border-white/10 text-white"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  Lưu Vào Nhánh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
