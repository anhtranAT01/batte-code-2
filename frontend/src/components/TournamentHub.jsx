import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../lib/api';

export default function TournamentHub() {
  const { user, getAuthHeaders, isAuthenticated } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState('SUBMIT'); // 'SUBMIT' | 'LEADERBOARD'

  // Bot Upload Form States
  const [submissionType, setSubmissionType] = useState('FILE'); // 'FILE' | 'GIT'
  const [botName, setBotName] = useState('');
  const [botFile, setBotFile] = useState(null);
  const [gitUrl, setGitUrl] = useState('');
  const [uploadStatus, setUploadStatus] = useState({ type: '', message: '' });
  const [uploading, setUploading] = useState(false);

  // User Bots State
  const [myBots, setMyBots] = useState([]);

  // Leaderboard & Tournament States
  const [tournamentInfo, setTournamentInfo] = useState(null);
  const [standings, setStandings] = useState([]);
  const [loadingStandings, setLoadingStandings] = useState(false);

  // Load user's bots if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchMyBots();
    }
  }, [isAuthenticated]);

  // Load leaderboard on tab select
  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchMyBots = async () => {
    try {
      const res = await fetch('/api/bots/my-bots', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setMyBots(data.data || []);
      }
    } catch (err) {
      console.warn('Error fetching bots:', err);
    }
  };

  const fetchLeaderboard = async () => {
    setLoadingStandings(true);
    try {
      // Fetch default active tournament standings
      const res = await fetch('/api/tournaments/1/standings');
      if (res.ok) {
        const data = await res.json();
        setTournamentInfo(data.data.tournament);
        setStandings(data.data.standings || []);
      } else {
        // Fallback default sample data if no tournament created yet
        setStandings([
          {
            userId: '1',
            username: 'AlphaScissors_Pro',
            botName: 'DeepScissors_v4',
            points: 12,
            elo: 1850,
            eloDelta: 120,
            matchesPlayed: 14,
            wins: 12,
            losses: 2,
            draws: 0,
            winRate: 86,
            avgWinDurationMs: 380,
            avgTurns: 22,
            infiniteLoopErrors: 0,
            botStatus: 'active',
          },
          {
            userId: '2',
            username: 'RockSolid_THPT',
            botName: 'TitanRock_AI',
            points: 10.5,
            elo: 1740,
            eloDelta: 85,
            matchesPlayed: 14,
            wins: 10,
            losses: 3,
            draws: 1,
            winRate: 71,
            avgWinDurationMs: 460,
            avgTurns: 26,
            infiniteLoopErrors: 0,
            botStatus: 'active',
          },
          {
            userId: '3',
            username: 'DeepPaper_v2',
            botName: 'OrigamiTactics',
            points: 9.5,
            elo: 1690,
            eloDelta: 60,
            matchesPlayed: 14,
            wins: 9,
            losses: 4,
            draws: 1,
            winRate: 64,
            avgWinDurationMs: 510,
            avgTurns: 29,
            infiniteLoopErrors: 0,
            botStatus: 'active',
          },
          {
            userId: '4',
            username: 'BrokenLoop_Test',
            botName: 'InfiniteWhile_Bot',
            points: 1,
            elo: 1100,
            eloDelta: -80,
            matchesPlayed: 8,
            wins: 1,
            losses: 7,
            draws: 0,
            winRate: 12,
            avgWinDurationMs: 1200,
            avgTurns: 6,
            infiniteLoopErrors: 5,
            botStatus: 'error',
          },
        ]);
      }
    } catch {
      // Handled silently
    } finally {
      setLoadingStandings(false);
    }
  };

  const handleBotSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      setUploadStatus({
        type: 'error',
        message: 'Vui lòng đăng nhập trước khi nộp Bot.',
      });
      return;
    }

    setUploading(true);
    setUploadStatus({ type: '', message: '' });

    try {
      if (submissionType === 'FILE') {
        if (!botFile) {
          throw new Error('Vui lòng chọn file Python (.py).');
        }

        const formData = new FormData();
        formData.append('name', botName || botFile.name);
        formData.append('file', botFile);

        const res = await fetch('/api/bots/upload', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Lỗi khi tải file bot lên.');

        setUploadStatus({
          type: 'success',
          message: 'Nộp Bot thành công! Cú pháp mã nguồn hợp lệ.',
        });
        setBotFile(null);
        setBotName('');
      } else {
        // Git submission
        if (!gitUrl.trim()) {
          throw new Error('Vui lòng nhập đường link Git repository.');
        }

        const res = await fetch('/api/bots/git', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            name: botName || 'Git Bot',
            gitUrl: gitUrl.trim(),
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Lỗi khi clone repository.');

        setUploadStatus({
          type: 'success',
          message: 'Git clone kho lưu trữ Bot thành công!',
        });
        setGitUrl('');
        setBotName('');
      }

      fetchMyBots();
    } catch (err) {
      setUploadStatus({
        type: 'error',
        message: err.message || 'Thao tác nộp bot thất bại.',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleExportExcel = () => {
    const tourneyId = tournamentInfo?.id || 1;
    window.open(apiUrl(`/api/tournaments/${tourneyId}/export/excel`), '_blank');
  };

  const handleExportCSV = () => {
    const tourneyId = tournamentInfo?.id || 1;
    window.open(apiUrl(`/api/tournaments/${tourneyId}/export/csv`), '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-tabs */}
      <div className="glass-panel p-4 lg:p-6 rounded-2xl border border-white/10 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Đấu Trường Giải Đấu 1.000 Học Sinh & Nộp Bot
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Hạ tầng máy chấm phân tán (Distributed Judge Workers), chống vòng lặp vô hạn và hệ Thụy Sĩ tự động
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex bg-dark-900/80 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveSubTab('SUBMIT')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'SUBMIT'
                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Nộp Mã Nguồn Bot
          </button>
          <button
            onClick={() => setActiveSubTab('LEADERBOARD')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'LEADERBOARD'
                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Bảng Xếp Hạng & Xuất Excel
          </button>
        </div>
      </div>

      {/* View 1: Bot Submission */}
      {activeSubTab === 'SUBMIT' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form */}
          <div className="lg:col-span-7 glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
              Nộp Thuật Toán Bot
            </h3>

            {/* Type selector */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSubmissionType('FILE')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                  submissionType === 'FILE'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/10'
                    : 'bg-dark-900/60 border-white/5 text-slate-400 hover:text-white'
                }`}
              >
                Tải File Python (.py)
              </button>
              <button
                type="button"
                onClick={() => setSubmissionType('GIT')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                  submissionType === 'GIT'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/10'
                    : 'bg-dark-900/60 border-white/5 text-slate-400 hover:text-white'
                }`}
              >
                Nhập Link Git Repo
              </button>
            </div>

            {/* Alert */}
            {uploadStatus.message && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  uploadStatus.type === 'success'
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/15 border border-red-500/30 text-red-300'
                }`}
              >
                <span className="status-dot"></span>
                <span>{uploadStatus.message}</span>
              </div>
            )}

            {/* Submission Form */}
            <form onSubmit={handleBotSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Tên Chiến Binh Bot
                </label>
                <input
                  type="text"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder="Ví dụ: AlphaScissors_v2"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-dark-900 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              {submissionType === 'FILE' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Chọn File Mã Nguồn (.py)
                  </label>
                  <div className="relative border-2 border-dashed border-white/15 hover:border-cyan-400/50 rounded-2xl p-6 text-center bg-dark-900/40 transition-colors">
                    <input
                      type="file"
                      accept=".py"
                      onChange={(e) => setBotFile(e.target.files[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <span className="feature-code mb-2">PY</span>
                    <p className="text-xs font-semibold text-slate-200">
                      {botFile ? botFile.name : 'Kéo thả file .py hoặc bấm để chọn file'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">Giới hạn tối đa 2MB mỗi file</p>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Đường Link Git Repository (Public)
                  </label>
                  <input
                    type="url"
                    value={gitUrl}
                    onChange={(e) => setGitUrl(e.target.value)}
                    placeholder="https://github.com/hocsinh/rps-bot.git"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-dark-900 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Hệ thống sẽ tự động thực thi <code>git clone --depth 1</code> và nhận diện file <code>bot.py</code> hoặc <code>main.py</code>.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={uploading}
                className="w-full py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all"
              >
                {uploading ? 'Đang Kiểm Tra Cú Pháp & Tải Lên...' : 'Xác Nhận Nộp Bot Lên Hệ Thống'}
              </button>
            </form>

            {/* My Submitted Bots */}
            {isAuthenticated && myBots.length > 0 && (
              <div className="pt-4 border-t border-white/10 space-y-2">
                <h4 className="text-xs font-bold text-slate-300">Bot Đã Nộp Của Bạn ({myBots.length}):</h4>
                <div className="space-y-2">
                  {myBots.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-dark-900/80 border border-white/5 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-bold text-white">{b.name}</p>
                          <p className="text-[10px] text-slate-400">
                            Loại: {b.source_type} | Thắng: {b.matches_won || 0}/{b.total_matches || 0} trận
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          b.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {b.status.toUpperCase()}
                        {b.error_count > 0 && ` (${b.error_count} lỗi)`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Student Bot I/O Protocol Specification Box */}
          <div className="lg:col-span-5 space-y-4">
            <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3 text-xs">
              <h3 className="font-bold text-amber-400 flex items-center gap-1.5 text-sm">
                Quy Chuẩn I/O Cho Học Sinh
              </h3>

              <div className="space-y-2 text-slate-300">
                <p>
                  <strong>1. Input (STDIN):</strong> Mỗi lượt đi, hệ thống sẽ đẩy một chuỗi JSON mô tả trạng thái bàn cờ:
                </p>
                <pre className="p-2.5 rounded-xl bg-dark-900 font-mono text-[10px] text-cyan-300 overflow-x-auto border border-white/5">
{`{
  "player_id": 1,
  "turn_number": 8,
  "grid": [
    [{"player": 1, "type": "ROCK"}, null, ...],
    ...
  ]
}`}
                </pre>

                <p>
                  <strong>2. Output (STDOUT):</strong> Bot của học sinh phải in ra 1 dòng JSON duy nhất chứa tọa độ nước đi:
                </p>
                <pre className="p-2.5 rounded-xl bg-dark-900 font-mono text-[10px] text-emerald-300 overflow-x-auto border border-white/5">
{`{"fromRow": 0, "fromCol": 0, "toRow": 1, "toCol": 0}`}
                </pre>

                <p className="text-red-300 font-semibold text-[11px]">
                  Giới hạn thời gian: Tối đa 1.0 giây/nước đi. Nếu code bị vòng lặp vô hạn (<code>while True</code>), máy chấm sẽ tự động dừng tiến trình và xử thua.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View 2: Leaderboard & Excel Export */}
      {activeSubTab === 'LEADERBOARD' && (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 glass-card p-4 rounded-2xl">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-white">Bảng Xếp Hạng Mùa Giải 2026</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold">
                Hệ Thụy Sĩ • Quy mô 1.000 Thí Sinh
              </span>
            </div>

            {/* Export buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExcel}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 transition-all"
              >
                Xuất Kết Quả Excel (.xlsx)
              </button>
              <button
                onClick={handleExportCSV}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-dark-800 hover:bg-dark-700 text-slate-300 hover:text-white border border-white/10 transition-all flex items-center gap-1"
              >
                Xuất CSV
              </button>
            </div>
          </div>

          {/* Standings Table */}
          <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-dark-900/90 text-slate-400 font-semibold border-b border-white/10 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-3.5 text-center">Hạng</th>
                    <th className="py-3 px-3.5">Thí Sinh</th>
                    <th className="py-3 px-3.5">Tên Bot AI</th>
                    <th className="py-3 px-3.5 text-center">Điểm Giải</th>
                    <th className="py-3 px-3.5 text-center">Điểm Elo</th>
                    <th className="py-3 px-3.5 text-center">Thay Đổi</th>
                    <th className="py-3 px-3.5 text-center">Trận</th>
                    <th className="py-3 px-3.5 text-center">Thắng/Thua</th>
                    <th className="py-3 px-3.5 text-center">Tỷ Lệ</th>
                    <th className="py-3 px-3.5 text-center">TG Thắng TB</th>
                    <th className="py-3 px-3.5 text-center">Lỗi Vòng Lặp</th>
                    <th className="py-3 px-3.5 text-center">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-medium">
                  {standings.map((st, idx) => {
                    const isTop1 = idx === 0;
                    const isTop2 = idx === 1;
                    const isTop3 = idx === 2;

                    return (
                      <tr
                        key={st.userId || idx}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-3 px-3.5 text-center font-bold">
                          {isTop1 ? (
                            <span className="text-amber-400 text-sm">1</span>
                          ) : isTop2 ? (
                            <span className="text-slate-300 text-sm">2</span>
                          ) : isTop3 ? (
                            <span className="text-amber-600 text-sm">3</span>
                          ) : (
                            <span className="text-slate-500">{idx + 1}</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 font-bold text-white">{st.username}</td>
                        <td className="py-3 px-3.5 font-mono text-slate-300">{st.botName}</td>
                        <td className="py-3 px-3.5 text-center font-bold text-cyan-400 font-mono">
                          {st.points}
                        </td>
                        <td className="py-3 px-3.5 text-center font-bold text-amber-400 font-mono">
                          {st.elo}
                        </td>
                        <td className="py-3 px-3.5 text-center font-mono">
                          {st.eloDelta > 0 ? (
                            <span className="text-emerald-400">+{st.eloDelta}</span>
                          ) : st.eloDelta < 0 ? (
                            <span className="text-rose-400">{st.eloDelta}</span>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center text-slate-300 font-mono">
                          {st.matchesPlayed}
                        </td>
                        <td className="py-3 px-3.5 text-center font-mono">
                          <span className="text-emerald-400">{st.wins}</span> /{' '}
                          <span className="text-rose-400">{st.losses}</span>
                        </td>
                        <td className="py-3 px-3.5 text-center font-semibold text-slate-200">
                          {st.winRate}%
                        </td>
                        <td className="py-3 px-3.5 text-center font-mono text-slate-400">
                          {st.avgWinDurationMs}ms
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          {st.infiniteLoopErrors > 0 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                              {st.infiniteLoopErrors} lỗi
                            </span>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              st.botStatus === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}
                          >
                            {st.botStatus.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
