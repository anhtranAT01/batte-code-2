import { matchLabel } from '../lib/matchLabel';
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { invalidatePublicData } from '../lib/publicData';

export default function AdminDashboardView({ onSelectReplay }) {
  const { user, getAuthHeaders, refreshProfile } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'bots' | 'tournaments' | 'stats'
  const [loading, setLoading] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);

  // Data states
  const [usersList, setUsersList] = useState([]);
  const [botsList, setBotsList] = useState([]);
  const [tourneysList, setTourneysList] = useState([]);
  const [statsData, setStatsData] = useState(null);
  const [matchesList, setMatchesList] = useState([]);
  const [matchOffset, setMatchOffset] = useState(0);
  const [hasMoreMatches, setHasMoreMatches] = useState(false);
  const [deleting, setDeleting] = useState('');
  const loadedTabs = useRef(new Set());
  const pendingTabs = useRef(new Set());
  const [fetchingTabs, setFetchingTabs] = useState({});
  const [accountUser, setAccountUser] = useState(null);
  const [accountName, setAccountName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState('');

  // Tournament creation form
  const [newTourneyName, setNewTourneyName] = useState('');
  const [newTourneyMode, setNewTourneyMode] = useState('ALL_IN'); // 'ALL_IN' | 'BRANCHES'
  const [newTourneyFaculty, setNewTourneyFaculty] = useState('Khoa Công Nghệ Thông Tin');
  const [newTourneySchedule, setNewTourneySchedule] = useState('');

  useEffect(() => {
    if (loadedTabs.current.has(activeTab) && activeTab !== 'matches') return;
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'bots') fetchBots();
    if (activeTab === 'tournaments') fetchTournaments();
    if (activeTab === 'stats') fetchStats();
    if (activeTab === 'matches' && isAdmin) fetchMatches();
  }, [activeTab, matchOffset]);

  const loadTab = async (tab, url, setter, authenticated = true, onMeta) => {
    if (pendingTabs.current.has(tab)) return;
    pendingTabs.current.add(tab);
    setFetchingTabs(previous => ({ ...previous, [tab]: true }));
    try {
      const res = await fetch(url, authenticated ? { headers: getAuthHeaders() } : undefined);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Không tải được dữ liệu quản trị.');
      setter(data.data ?? (tab === 'stats' ? null : []));
      onMeta?.(data);
      loadedTabs.current.add(tab);
    } catch (error) {
      setAlertMsg({ type: 'error', text: error.message });
    } finally {
      pendingTabs.current.delete(tab);
      setFetchingTabs(previous => ({ ...previous, [tab]: false }));
    }
  };
  const fetchUsers = () => loadTab('users', '/api/admin/users', setUsersList);
  const fetchBots = () => loadTab('bots', '/api/admin/bots', setBotsList);
  const fetchTournaments = () => loadTab('tournaments', '/api/tournaments', setTourneysList, false);
  const fetchStats = () => loadTab('stats', '/api/admin/stats', setStatsData);
  const fetchMatches = () => loadTab('matches', `/api/admin/matches?limit=25&offset=${matchOffset}`,
    setMatchesList, true, result => setHasMoreMatches(Boolean(result.pagination?.hasMore)));

  const handleDelete = async (kind,item) => {
    if (!isAdmin || deleting || (kind === 'users' && item.id === user.id)) return;
    const description = kind === 'users'
      ? `Xóa vĩnh viễn tài khoản "${item.username}"? Bot, đăng ký giải và lịch sử trận liên quan cũng bị xóa. Điểm Elo của người khác được giữ nguyên.`
      : `Xóa vĩnh viễn trận ${item.id}? Bản ghi và replay sẽ bị xóa. Điểm Elo và kết quả giải đấu đã tính được giữ nguyên.`;
    if (!confirm(description)) return;
    setDeleting(`${kind}:${item.id}`);
    try {
      const response = await fetch(`/api/admin/${kind}/${item.id}`, {method:'DELETE',headers:getAuthHeaders()});
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Không thể xóa dữ liệu.');
      invalidatePublicData();
      for (const tab of ['users','bots','matches','stats','tournaments']) loadedTabs.current.delete(tab);
      setStatsData(null);
      if (kind === 'matches') setMatchesList(previous => previous.filter(row => row.id !== item.id));
      if (kind === 'users') {
        setUsersList(previous => previous.filter(row => row.id !== item.id));
        setBotsList(previous => previous.filter(row => row.user_id !== item.id));
        await fetchUsers();
      } else if (matchesList.length === 1 && matchOffset > 0) setMatchOffset(offset => Math.max(0,offset-25));
      else await fetchMatches();
      setAlertMsg({type:'success',text:result.message});
    } catch (error) { setAlertMsg({type:'error',text:error.message}); }
    finally { setDeleting(''); }
  };

  const openAccount = (selectedUser) => {
    setAccountUser(selectedUser);
    setAccountName(selectedUser.username);
    setNewPassword('');
    setConfirmPassword('');
    setAccountError('');
  };

  const handleSaveAccount = async (action) => {
    if (!accountUser || accountBusy) return;
    if (action === 'password' && newPassword !== confirmPassword) {
      setAccountError('Hai lần nhập mật khẩu chưa khớp.');
      return;
    }
    if (action === 'password' && (newPassword.length < 8 || new TextEncoder().encode(newPassword).length > 72)) {
      setAccountError('Mật khẩu mới phải dài ít nhất 8 ký tự và tối đa 72 byte.');
      return;
    }
    setAccountBusy(true);
    setAccountError('');
    try {
      const res = await fetch(`/api/admin/users/${accountUser.id}/${action}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(action === 'password' ? { password: newPassword } : { username: accountName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Không cập nhật được tài khoản.');
      setUsersList(previous => previous.map(item => item.id === accountUser.id ? { ...item, ...data.data } : item));
      setAlertMsg({ type: 'success', text: data.message });
      if (action === 'account' && accountUser.id === user.id) await refreshProfile?.();
      setAccountUser(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setAccountError(error.message);
    } finally {
      setAccountBusy(false);
    }
  };

  // Change user role
  const handleChangeRole = async (userId, newRole) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAlertMsg({ type: 'success', text: data.message });
      setUsersList(previous => previous.map(item => item.id === userId ? { ...item, ...data.data } : item));
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.message });
    }
  };

  // Adjust user Elo
  const handleAdjustElo = async (userId, currentElo) => {
    const input = prompt('Nhập điểm Elo mới cho học sinh (100 - 3500):', currentElo);
    if (!input || isNaN(input)) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}/elo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ elo: parseInt(input, 10) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAlertMsg({ type: 'success', text: data.message });
      fetchUsers();
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.message });
    }
  };

  // Delete bot
  const handleDeleteBot = async (botId, botName) => {
    if (!confirm(`Xóa bot "${botName}" khỏi hệ thống?`)) return;
    try {
      const res = await fetch(`/api/admin/bots/${botId}`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAlertMsg({ type: 'success', text: data.message });
      fetchBots();
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.message });
    }
  };

  // Test run bot
  const handleTestBot = async (botId, botName) => {
    setLoading(true);
    setAlertMsg(null);
    try {
      const res = await fetch('/api/game/bot-vs-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          bot1Id: botId,
          bot2Level: 'MEDIUM',
          boardSize: 9,
          difficulty: 'medium',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      const match = data.data;
      setAlertMsg({
        type: 'success',
        text: `Kiểm thử "${botName}" hoàn tất: ${match.winner === 1 ? 'Bot THẮNG' : 'Bot THUA'} sau ${match.totalTurns} lượt.`,
      });
      if (match.replay && onSelectReplay) {
        onSelectReplay(match.replay);
      }
    } catch (err) {
      setAlertMsg({ type: 'error', text: `Lỗi kiểm thử bot: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  // Create University Tournament
  const handleCreateTournament = async (e) => {
    e.preventDefault();
    if (!newTourneyName.trim()) return;
    try {
      const res = await fetch('/api/admin/tournaments/university', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          name: newTourneyName.trim(),
          mode: newTourneyMode,
          faculty: newTourneyFaculty,
          scheduledStartAt: newTourneySchedule ? new Date(newTourneySchedule).toISOString() : null,
          maxParticipants: newTourneyMode === 'BRANCHES' ? 16 : 1000,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAlertMsg({ type: 'success', text: data.message });
      setNewTourneyName('');
      setNewTourneySchedule('');
      fetchTournaments();
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.message });
    }
  };

  // Run bracket tournament matches
  const handleRunBrackets = async (tourneyId, tourneyName) => {
    if (!confirm(`Tự động chạy toàn bộ các cặp đấu trong nhánh của "${tourneyName}"?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tournaments/${tourneyId}/brackets/run-all`, {
        method: 'POST',
        headers: { ...getAuthHeaders() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAlertMsg({ type: 'success', text: data.message });
      fetchTournaments();
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Trigger batch grading for tournament
  const handleBatchGrade = async (tourneyId, tourneyName) => {
    if (!confirm(`Khởi chạy máy chấm tự động toàn bộ vòng đấu cho "${tourneyName}"?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tournaments/${tourneyId}/batch-grade`, {
        method: 'POST',
        headers: { ...getAuthHeaders() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAlertMsg({ type: 'success', text: data.message });
      fetchTournaments();
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Delete Tournament
  const handleDeleteTournament = async (tourneyId, tourneyName) => {
    if (!confirm(`Xóa giải đấu "${tourneyName}"?`)) return;
    try {
      const res = await fetch(`/api/admin/tournaments/${tourneyId}`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAlertMsg({ type: 'success', text: data.message });
      fetchTournaments();
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="view-shell animate-fadeIn max-w-7xl mx-auto">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-wide">
              Quản trị hệ thống
            </h1>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
              Quyền Giáo Viên / Admin
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Quản lý toàn bộ thí sinh, kho bot học sinh, tạo giải đấu theo khối và kích hoạt máy chấm tự động
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#0e1322] border border-white/5 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'users' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Tài Khoản{loadedTabs.current.has('users') ? ` (${usersList.length})` : ''}
          </button>
          <button
            onClick={() => setActiveTab('bots')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'bots' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Kho Bot{loadedTabs.current.has('bots') ? ` (${botsList.length})` : ''}
          </button>
          {isAdmin && <button onClick={() => setActiveTab('matches')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'matches' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>
            Trận Đấu
          </button>}
          <button
            onClick={() => setActiveTab('tournaments')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'tournaments' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Giải Đấu Khối{loadedTabs.current.has('tournaments') ? ` (${tourneysList.length})` : ''}
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'stats' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Hạ Tầng & Queue
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {alertMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            alertMsg.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-red-950/40 border-red-500/30 text-red-300'
          }`}
        >
          <span>{alertMsg.text}</span>
          <button onClick={() => setAlertMsg(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {fetchingTabs[activeTab] && <p className="text-sm text-slate-400" role="status">Đang tải dữ liệu...</p>}

      {/* Overview Metric Cards */}
      {activeTab === 'stats' && statsData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-[#0e1322]/80 border border-white/5 backdrop-blur-md">
            <span className="text-xs text-slate-400 font-medium">Tổng Thí Sinh</span>
            <div className="text-2xl font-black text-white mt-1">{statsData.totalUsers}</div>
          </div>
          <div className="p-4 rounded-2xl bg-[#0e1322]/80 border border-white/5 backdrop-blur-md">
            <span className="text-xs text-slate-400 font-medium">Tổng Bot Đã Nộp</span>
            <div className="text-2xl font-black text-indigo-400 mt-1">{statsData.totalBots}</div>
          </div>
          <div className="p-4 rounded-2xl bg-[#0e1322]/80 border border-white/5 backdrop-blur-md">
            <span className="text-xs text-slate-400 font-medium">Trận Đấu Đã Xử Lý</span>
            <div className="text-2xl font-black text-emerald-400 mt-1">{statsData.totalMatches}</div>
          </div>
          <div className="p-4 rounded-2xl bg-[#0e1322]/80 border border-white/5 backdrop-blur-md">
            <span className="text-xs text-slate-400 font-medium">Máy Chấm BullMQ</span>
            <div className="text-xs font-mono text-amber-300 mt-2 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${statsData.queueAvailable ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span>{statsData.queueAvailable ? `Chờ: ${statsData.judgeQueue?.waiting || 0} | Đang chạy: ${statsData.judgeQueue?.active || 0}` : 'Chưa kết nối hàng đợi'}</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: USERS MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="rounded-2xl border border-white/5 bg-[#0e1322]/80 backdrop-blur-md overflow-hidden shadow-xl shadow-black/30">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="font-bold text-white text-sm">Danh Sách Toàn Bộ Tài Khoản & Học Sinh</h3>
            <button onClick={fetchUsers} className="text-xs text-indigo-400 hover:text-indigo-300">Làm mới ↻</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-slate-400 font-bold bg-[#090d18]/70">
                  <th className="py-3 px-5">TÊN HỌC SINH</th>
                  <th className="py-3 px-5">QUYỀN HẠN</th>
                  <th className="py-3 px-5">ELO HIỆN TẠI</th>
                  <th className="py-3 px-5">SỐ BOT</th>
                  <th className="py-3 px-5">THẮNG / THUA</th>
                  <th className="py-3 px-5">NGÀY TẠO</th>
                  <th className="py-3 px-5 text-right">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {usersList.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-5 font-bold text-white">{u.username}</td>
                    <td className="py-3.5 px-5">
                      <select
                        value={u.role}
                        onChange={(e) => handleChangeRole(u.id, e.target.value)}
                        disabled={!isAdmin || u.id === user?.id}
                        aria-label={`Quyền của ${u.username}`}
                        title={!isAdmin ? 'Chỉ Admin được đổi quyền tài khoản' : u.id === user?.id ? 'Không thể tự gỡ quyền Admin' : 'Đổi quyền tài khoản'}
                        className="py-1 px-2 rounded-lg bg-[#090d18] border border-white/10 text-xs font-semibold text-slate-200"
                      >
                        <option value="STUDENT">STUDENT (Học sinh)</option>
                        <option value="TEACHER">TEACHER (Giáo viên)</option>
                        <option value="ADMIN">ADMIN (Quản trị)</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-5 font-mono font-bold text-amber-400">{u.elo_rating}</td>
                    <td className="py-3.5 px-5 text-slate-300">{u.bot_count} bot</td>
                    <td className="py-3.5 px-5 font-mono">
                      <span className="text-emerald-400">{u.wins}W</span> / <span className="text-red-400">{u.losses}L</span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-400">
                      {new Date(u.created_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="py-3.5 px-5 text-right space-x-2 whitespace-nowrap">
                      {isAdmin && <button
                        onClick={() => openAccount(u)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-semibold"
                        aria-label={`Quản lý tài khoản ${u.username}`}
                      >
                        Tài khoản / Mật khẩu
                      </button>}
                      <button
                        onClick={() => handleAdjustElo(u.id, u.elo_rating)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-semibold"
                      >
                        Chỉnh Elo
                      </button>
                      {isAdmin && <button type="button" onClick={() => handleDelete('users',u)}
                        disabled={Boolean(deleting) || u.id === user.id}
                        aria-label={`Xóa người dùng ${u.username}`}
                        title={u.id === user.id ? 'Không thể xóa chính tài khoản đang dùng' : 'Xóa tài khoản, bot và lịch sử liên quan'}
                        className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 font-semibold disabled:opacity-40">
                        {deleting === `users:${u.id}` ? 'Đang xóa…' : 'Xóa người dùng'}
                      </button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!isAdmin && <p className="p-4 text-xs text-slate-400">Chỉ Admin được sửa tên đăng nhập, phân quyền và đặt lại mật khẩu.</p>}
        </div>
      )}

      {/* TAB 2: BOTS MANAGEMENT */}
      {activeTab === 'matches' && isAdmin && <div className="rounded-2xl border border-white/5 bg-[#0e1322]/80 overflow-hidden">
        <ReplayRetentionSettings getAuthHeaders={getAuthHeaders} />
        <div className="p-4 border-b border-white/5 flex flex-wrap justify-between gap-3">
          <div><h3 className="font-bold text-white text-sm">Quản Lý Trận Đấu</h3>
            <p className="text-xs text-slate-400 mt-1">Xóa bản ghi và replay; giữ nguyên Elo và kết quả giải đấu đã tính.</p></div>
          <button onClick={fetchMatches} disabled={fetchingTabs.matches || Boolean(deleting)} className="text-xs text-indigo-400">Làm mới ↻</button>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs">
          <thead className="text-slate-400 bg-[#090d18]/70"><tr>
            {['MÃ TRẬN','XANH (P1)','ĐỎ (P2)','KẾT QUẢ','NGÀY TẠO','THAO TÁC'].map(label => <th key={label} className="py-3 px-4">{label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-white/5">{matchesList.map(match => <tr key={match.id}>
            <td className="py-3 px-4 font-mono text-slate-300" title={match.id}><span className="match-label">{matchLabel(match)}</span></td>
            <td className="py-3 px-4 text-blue-300">{match.p1_username || 'Khách'}</td>
            <td className="py-3 px-4 text-red-300">{match.p2_username || 'Boss AI'}</td>
            <td className="py-3 px-4 text-slate-300">{match.winner_username ? `${match.winner_username} thắng` : match.result_known ? 'Hòa' : 'Chưa xác định'}</td>
            <td className="py-3 px-4 text-slate-400">{new Date(match.created_at).toLocaleString('vi-VN')}</td>
            <td className="py-3 px-4 whitespace-nowrap">
              {match.replay_expired_at ? <span className="mr-3 text-slate-400">Replay đã hết hạn</span> : onSelectReplay && <button onClick={() => onSelectReplay(match.id)} className="mr-3 text-indigo-400">Xem lại</button>}
              <button type="button" onClick={() => handleDelete('matches',match)} disabled={Boolean(deleting)}
                aria-label={`Xóa trận ${match.id}`} className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 disabled:opacity-40">
                {deleting === `matches:${match.id}` ? 'Đang xóa…' : 'Xóa trận'}
              </button>
            </td>
          </tr>)}</tbody>
        </table></div>
        {!fetchingTabs.matches && !matchesList.length && <p className="p-5 text-sm text-slate-400">Chưa có trận đấu ở trang này.</p>}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-white/5 text-xs text-slate-300">
          <button onClick={() => setMatchOffset(offset => Math.max(0,offset-25))} disabled={!matchOffset || fetchingTabs.matches || Boolean(deleting)}>← Trang trước</button>
          <span>Trang {Math.floor(matchOffset/25)+1}</span>
          <button onClick={() => setMatchOffset(offset => offset+25)} disabled={!hasMoreMatches || fetchingTabs.matches || Boolean(deleting)}>Trang sau →</button>
        </div>
      </div>}
      {activeTab === 'bots' && (
        <div className="rounded-2xl border border-white/5 bg-[#0e1322]/80 backdrop-blur-md overflow-hidden shadow-xl shadow-black/30">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="font-bold text-white text-sm">Kho Thuật Toán Bot Python Toàn Trường</h3>
            <button onClick={fetchBots} className="text-xs text-indigo-400 hover:text-indigo-300">Làm mới ↻</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-slate-400 font-bold bg-[#090d18]/70">
                  <th className="py-3 px-5">TÊN BOT</th>
                  <th className="py-3 px-5">TÁC GIẢ (HỌC SINH)</th>
                  <th className="py-3 px-5">NGUỒN</th>
                  <th className="py-3 px-5">TRẠNG THÁI</th>
                  <th className="py-3 px-5">LỖI PHÁT HIỆN</th>
                  <th className="py-3 px-5">NGÀY NỘP</th>
                  <th className="py-3 px-5 text-right">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {botsList.map((b) => (
                  <tr key={b.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-5 font-bold text-white flex items-center gap-2">
                      <span>{b.name}</span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-300">{b.username} ({b.elo_rating} Elo)</td>
                    <td className="py-3.5 px-5 font-mono uppercase text-slate-400">{b.source_type}</td>
                    <td className="py-3.5 px-5">
                      {b.is_active ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                          ĐANG KÍCH HOẠT
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-white/5 text-slate-400 text-[10px]">Dự bị</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-amber-400">{b.error_count || 0}</td>
                    <td className="py-3.5 px-5 text-slate-400">
                      {new Date(b.created_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="py-3.5 px-5 text-right space-x-2">
                      <button
                        onClick={() => handleTestBot(b.id, b.name)}
                        disabled={loading}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-semibold"
                      >
                        Chạy Kiểm Thử
                      </button>
                      <button
                        onClick={() => handleDeleteBot(b.id, b.name)}
                        className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 font-semibold"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TOURNAMENTS & GRADES */}
      {activeTab === 'tournaments' && (
        <div className="space-y-6">
          {/* Create University Tournament Form */}
          <div className="p-6 rounded-2xl bg-[#0e1322]/80 border border-white/5 backdrop-blur-md">
            <h3 className="font-bold text-white text-base mb-4">Khởi Tạo Giải Đấu Sinh Viên Đại Học Mới</h3>
            <form onSubmit={handleCreateTournament} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Tên Giải Đấu
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Cúp Vô Địch AI Khoa CNTT 2026..."
                  value={newTourneyName}
                  onChange={(e) => setNewTourneyName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#090d18] border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Chế Độ Giải Đấu
                </label>
                <select
                  value={newTourneyMode}
                  onChange={(e) => setNewTourneyMode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#090d18] border border-white/10 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL_IN">Mục 1: Thi Đấu Toàn Thể (All-In)</option>
                  <option value="BRANCHES">Mục 2: Nhánh Đấu Riêng Lẻ (Branches)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Khoa / Viện Phụ Trách
                </label>
                <select
                  value={newTourneyFaculty}
                  onChange={(e) => setNewTourneyFaculty(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#090d18] border border-white/10 text-white text-xs font-medium focus:outline-none focus:border-indigo-500"
                >
                  <option value="Khoa Công Nghệ Thông Tin">Khoa Công Nghệ Thông Tin</option>
                  <option value="Viện Trí Tuệ Nhân Tạo (AI)">Viện Trí Tuệ Nhân Tạo (AI)</option>
                  <option value="Khoa Kỹ Thuật Máy Tính">Khoa Kỹ Thuật Máy Tính</option>
                  <option value="Toàn Trường Đại Học">Toàn Trường Đại Học</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Lịch Khởi Tranh (Bắt Đầu)
                </label>
                <input
                  type="datetime-local"
                  value={newTourneySchedule}
                  onChange={(e) => setNewTourneySchedule(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#090d18] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="md:col-span-2 flex items-end justify-end">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <span>Khởi Tạo Giải Đấu Ngay</span>
                </button>
              </div>
            </form>
          </div>

          {/* Tournaments List & Batch Grading Trigger */}
          <div className="rounded-2xl border border-white/5 bg-[#0e1322]/80 backdrop-blur-md overflow-hidden shadow-xl shadow-black/30">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">Danh Sách Giải Đấu & Cơ Chế Chấm Điểm</h3>
              <button onClick={fetchTournaments} className="text-xs text-indigo-400 hover:text-indigo-300">Làm mới ↻</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-[11px] uppercase tracking-wider text-slate-400 font-bold bg-[#090d18]/70">
                    <th className="py-3.5 px-5">TÊN GIẢI ĐẤU</th>
                    <th className="py-3.5 px-5">CHẾ ĐỘ</th>
                    <th className="py-3.5 px-5">TRẠNG THÁI</th>
                    <th className="py-3.5 px-5">LỊCH KHỞI TRANH</th>
                    <th className="py-3.5 px-5 text-right">THAO TÁC QUẢN TRỊ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {tourneysList.map((t) => {
                    const isBranches = t.mode === 'BRANCHES' || t.brackets_json?.length > 0;
                    return (
                      <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 px-5 font-bold text-white">
                          <div>{t.name}</div>
                          <div className="text-[11px] text-indigo-400 mt-0.5">
                            {t.settings_json?.faculty || 'Khoa CNTT - Viện AI'}
                          </div>
                        </td>

                        <td className="py-4 px-5">
                          {isBranches ? (
                            <span className="px-2.5 py-1 rounded-full font-bold text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              NHÁNH ĐẤU
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full font-bold text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              TOÀN THỂ
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                              t.status === 'ONGOING'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : t.status === 'UPCOMING'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-white/5 text-slate-400'
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>

                        <td className="py-4 px-5 font-mono text-slate-300">
                          {t.scheduled_start_at
                            ? new Date(t.scheduled_start_at).toLocaleString('vi-VN')
                            : 'Chưa cài đặt'}
                        </td>

                        <td className="py-4 px-5 text-right space-x-2">
                          {isBranches ? (
                            <button
                              onClick={() => handleRunBrackets(t.id, t.name)}
                              disabled={loading}
                              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold shadow-md transition-all"
                            >
                              Chạy Toàn Nhánh
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBatchGrade(t.id, t.name)}
                              disabled={loading}
                              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold shadow-md transition-all"
                            >
                              Chấm Điểm Toàn Bộ
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteTournament(t.id, t.name)}
                            className="px-2.5 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 font-semibold"
                            title="Xóa giải đấu"
                          >
                            Xóa
                          </button>
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

      {/* TAB 4: SYSTEM METRICS & QUEUE */}
      {activeTab === 'stats' && statsData && (
        <div className="p-6 rounded-2xl bg-[#0e1322]/80 border border-white/5 backdrop-blur-md space-y-4">
          <h3 className="font-bold text-white text-base">Trạng Thái Hệ Thống & Hàng Đợi Chấm BullMQ</h3>
          {!statsData.queueAvailable && <p className="text-xs text-amber-400">Chưa kết nối được Redis. Số liệu hàng đợi tạm thời chưa có.</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-4 rounded-xl bg-[#090d18] border border-white/5 space-y-2">
              <div className="text-slate-400 font-bold uppercase">Hàng Đợi Máy Chấm (Redis BullMQ):</div>
              <div className="text-white flex justify-between"><span>Waiting Jobs:</span><span className="text-amber-400 font-bold">{statsData.judgeQueue?.waiting || 0}</span></div>
              <div className="text-white flex justify-between"><span>Active Jobs:</span><span className="text-emerald-400 font-bold">{statsData.judgeQueue?.active || 0}</span></div>
              <div className="text-white flex justify-between"><span>Completed Jobs:</span><span className="text-cyan-400 font-bold">{statsData.judgeQueue?.completed || 0}</span></div>
              <div className="text-white flex justify-between"><span>Failed Jobs:</span><span className="text-red-400 font-bold">{statsData.judgeQueue?.failed || 0}</span></div>
            </div>

            <div className="p-4 rounded-xl bg-[#090d18] border border-white/5 space-y-2">
              <div className="text-slate-400 font-bold uppercase">Thời Gian Hoạt Động (Uptime):</div>
              <div className="text-white flex justify-between"><span>Server Uptime:</span><span>{Math.floor(statsData.uptimeSeconds / 60)} phút</span></div>
              <div className="text-white flex justify-between"><span>Cơ Chế Timeout:</span><span className="text-amber-400">1.0 giây / lượt</span></div>
              <div className="text-white flex justify-between"><span>Bảo Vệ Vòng Lặp:</span><span className="text-emerald-400">Kích hoạt (Ngắt khi lặp 5 lần)</span></div>
            </div>
          </div>
        </div>
      )}

      {accountUser && isAdmin && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="account-dialog-title" className="w-full max-w-lg p-6 rounded-2xl bg-[#0e1322] border border-white/10 shadow-2xl space-y-5">
            <div className="flex items-center justify-between gap-4">
              <h2 id="account-dialog-title" className="text-lg font-bold text-white">Tài khoản: {accountUser.username}</h2>
              <button onClick={() => setAccountUser(null)} disabled={accountBusy} aria-label="Đóng quản lý tài khoản" className="text-slate-400 px-2 py-1">✕</button>
            </div>
            {accountError && <p role="alert" className="text-sm text-red-400">{accountError}</p>}
            <form onSubmit={event => { event.preventDefault(); handleSaveAccount('account'); }} className="space-y-3">
              <label className="block text-xs font-bold text-slate-400" htmlFor="admin-account-name">Tên đăng nhập</label>
              <input id="admin-account-name" value={accountName} onChange={event => setAccountName(event.target.value)} autoComplete="off" required minLength={3} maxLength={30} pattern="[a-zA-Z0-9_]+" className="w-full rounded-xl px-3 py-2.5 bg-[#090d18] border border-white/10 text-white text-sm" />
              <button type="submit" disabled={accountBusy || accountName.trim() === accountUser.username} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-50">Lưu tên đăng nhập</button>
            </form>
            <form onSubmit={event => { event.preventDefault(); handleSaveAccount('password'); }} className="space-y-3 pt-4 border-t border-white/10">
              <p className="text-xs text-slate-400">Đặt mật khẩu mới cho người dùng. Mật khẩu hiện tại không được hiển thị.</p>
              <label className="block text-xs font-bold text-slate-400" htmlFor="admin-new-password">Mật khẩu mới (ít nhất 8 ký tự)</label>
              <input id="admin-new-password" type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} autoComplete="new-password" required minLength={8} maxLength={72} className="w-full rounded-xl px-3 py-2.5 bg-[#090d18] border border-white/10 text-white text-sm" />
              <label className="block text-xs font-bold text-slate-400" htmlFor="admin-confirm-password">Nhập lại mật khẩu mới</label>
              <input id="admin-confirm-password" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" required minLength={8} maxLength={72} className="w-full rounded-xl px-3 py-2.5 bg-[#090d18] border border-white/10 text-white text-sm" />
              <button type="submit" disabled={accountBusy} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">{accountBusy ? 'Đang lưu...' : 'Đặt lại mật khẩu'}</button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export function ReplayRetentionSettings({getAuthHeaders}) {
  const [settings,setSettings]=useState(null),[days,setDays]=useState('0');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const headersRef=useRef(getAuthHeaders);headersRef.current=getAuthHeaders;
  const load=async(signal)=>{
    setMessage('');
    try {
      const res=await fetch('/api/admin/replay-retention',{headers:headersRef.current(),signal});
      const result=await res.json();
      if(!res.ok)throw new Error(result.message || 'Không tải được cấu hình lưu replay.');
      if(signal?.aborted)return;
      setSettings(result.data);setDays(String(result.data.days ?? 0));
    } catch(error){if(error.name!=='AbortError')setMessage(error.message);}
  };
  useEffect(()=>{const controller=new AbortController();load(controller.signal);return()=>controller.abort();},[]);
  const save=async(event)=>{
    event.preventDefault();
    const value=Number(days);
    if(!days.trim() || !Number.isInteger(value) || value<0 || value>3650){setMessage('Nhập số ngày nguyên từ 0 đến 3650.');return;}
    if(value>0 && !window.confirm(`Tự xóa replay PvP đã kết thúc quá ${value} ngày? Replay đã xóa không khôi phục được. Kết quả, Elo và bảng điểm vẫn được giữ. Các replay PvP cũ đủ hạn cũng sẽ được dọn.`))return;
    setBusy(true);setMessage('');
    try {
      const res=await fetch('/api/admin/replay-retention',{method:'PUT',headers:{...headersRef.current(),'Content-Type':'application/json'},body:JSON.stringify({days:value})});
      const result=await res.json();
      if(!res.ok)throw new Error(result.message || 'Không lưu được cấu hình.');
      setSettings(result.data);setDays(String(result.data.days));setMessage('Đã lưu. Hệ thống kiểm tra tự dọn mỗi 5 phút.');
    } catch(error){setMessage(error.message);}finally{setBusy(false);}
  };
  return <section className="p-4 border-b border-white/10 space-y-3" aria-label="Thời gian lưu replay">
    <div><h3 className="font-bold text-white">Thời gian lưu replay PvP</h3><p className="text-xs text-slate-400 mt-1">Chỉ Admin được đặt thời gian lưu trận giữa hai người chơi; mặc định không tự xóa. Trận đấu với máy luôn tự hết hạn sau 24 giờ. Dọn mỗi 5 phút, giữ mã trận, kết quả, Elo và bảng điểm.</p></div>
    <form onSubmit={save} className="flex flex-wrap items-end gap-3">
      <label className="text-xs text-slate-300" htmlFor="replay-retention-days">Số ngày lưu PvP (0 = không tự xóa)
        <input id="replay-retention-days" type="number" min="0" max="3650" step="1" required value={days} disabled={!settings || busy} onChange={event=>setDays(event.target.value)} className="block mt-1 w-48 rounded-lg bg-navy-950 border border-white/10 p-2" />
      </label>
      <button type="submit" disabled={!settings || busy} className="primary-action text-xs disabled:opacity-50">{busy?'Đang lưu…':'Lưu thời gian'}</button>
      <button type="button" onClick={()=>load()} disabled={busy} className="secondary-action text-xs">Làm mới cấu hình</button>
    </form>
    {settings?.lastCleanup && <p className="text-xs text-slate-400">Kiểm tra gần nhất: {new Date(settings.lastCleanup.checkedAt).toLocaleString('vi-VN')} · Đã dọn {settings.lastCleanup.removed} replay trong lượt đó.</p>}
    {message && <p role="status" className="text-sm text-slate-300">{message}</p>}
  </section>;
}
