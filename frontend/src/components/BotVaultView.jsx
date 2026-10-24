import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const TACTIC_OPTIONS = [
  { id: 'FLAG_RUSHER', label: 'Cướp Cờ Thần Tốc (A* Flag Rusher)', desc: 'Tính đường đi ngắn nhất đâm thẳng vào Căn cứ Cờ đối phương để thắng chớp nhoáng' },
  { id: 'FLAG_DEFENDER', label: 'Thủ Căn Cứ & Bẫy Quân (Flag Defender)', desc: 'Bố trí chốt chặn cửa ngõ căn cứ nhà, bọc lót theo bộ 3 Kéo-Búa-Bao' },
  { id: 'COMBAT_HUNTER', label: 'Săn Lùng & Diệt Địch (Minimax Combat)', desc: 'Dự đoán nước đi 3-4 bước, săn lùng ăn quân đối phương để giành ưu thế áp đảo' },
  { id: 'POTION_COLLECTOR', label: 'Thu Thập Vật Phẩm (Potion Hunter)', desc: 'Ưu tiên nhặt vật phẩm tăng tốc và đồng hóa trước khi giao tranh' },
];

export default function BotVaultView() {
  const { user, getAuthHeaders } = useAuth();

  const [myBots, setMyBots] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('vault'); // 'vault' | 'templates' | 'upload' | 'guide'

  // Upload/Create state
  const [botName, setBotName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [gitUrl, setGitUrl] = useState('');
  const [codeContent, setCodeContent] = useState('');
  const [selectedTactic, setSelectedTactic] = useState('FLAG_RUSHER');
  const [uploadMode, setUploadMode] = useState('code'); // 'code' | 'file' | 'git'
  const [uploading, setUploading] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);

  useEffect(() => {
    fetchMyBots();
    fetchTemplates();
  }, [user]);

  const fetchMyBots = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/bots/my-bots', { headers: getAuthHeaders() });
      if (res.ok) {
        const d = await res.json();
        setMyBots(d.data || []);
      }
    } catch (e) {
      console.warn('Bot fetch error:', e);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/bots/templates');
      if (res.ok) {
        const d = await res.json();
        const list = d.data || [];
        setTemplates(list);
        if (list.length > 0) {
          setSelectedTemplate(list[0]);
          if (!codeContent) {
            setCodeContent(list[0].code);
          }
        }
      }
    } catch (e) {
      console.warn('Templates fetch error:', e);
    }
  };

  // Activate bot
  const handleActivateBot = async (botId) => {
    try {
      const res = await fetch(`/api/bots/${botId}/activate`, {
        method: 'POST',
        headers: { ...getAuthHeaders() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAlertMsg({ type: 'success', text: data.message });
      fetchMyBots();
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.message });
    }
  };

  // Change tactic
  const handleChangeTactic = async (botId, newTactic) => {
    try {
      const res = await fetch(`/api/bots/${botId}/tactic`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ tactic: newTactic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAlertMsg({ type: 'success', text: `Đã đổi chiến thuật thành công: ${newTactic}` });
      fetchMyBots();
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.message });
    }
  };

  // Delete bot
  const handleDeleteBot = async (botId, name) => {
    if (!confirm(`Bạn có chắc muốn xóa bot "${name}"?`)) return;
    try {
      const res = await fetch(`/api/bots/${botId}`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAlertMsg({ type: 'success', text: 'Đã xóa bot thành công.' });
      fetchMyBots();
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.message });
    }
  };

  // Handle submit bot
  const handleSubmitBot = async (e) => {
    e.preventDefault();
    if (!botName.trim()) {
      setAlertMsg({ type: 'error', text: 'Vui lòng đặt tên cho Bot.' });
      return;
    }

    setUploading(true);
    setAlertMsg(null);

    try {
      if (uploadMode === 'code') {
        if (!codeContent.trim()) {
          throw new Error('Vui lòng nhập nội dung mã nguồn Python.');
        }
        const res = await fetch('/api/bots/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            name: botName.trim(),
            code: codeContent.trim(),
            tactic: selectedTactic,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Khởi tạo bot thất bại.');
        setAlertMsg({ type: 'success', text: data.message });
      } else if (uploadMode === 'file') {
        if (!selectedFile) {
          throw new Error('Vui lòng chọn file mã nguồn Python (.py).');
        }
        const formData = new FormData();
        formData.append('name', botName.trim());
        formData.append('file', selectedFile);

        const res = await fetch('/api/bots/upload', {
          method: 'POST',
          headers: { ...getAuthHeaders() },
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Tải lên bot thất bại.');
        setAlertMsg({ type: 'success', text: data.message });
      } else {
        if (!gitUrl.trim()) {
          throw new Error('Vui lòng cung cấp URL Git repository.');
        }
        const res = await fetch('/api/bots/git', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ name: botName.trim(), gitUrl: gitUrl.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Clone Git repository thất bại.');
        setAlertMsg({ type: 'success', text: data.message });
      }

      setBotName('');
      setSelectedFile(null);
      setGitUrl('');
      setActiveSubTab('vault');
      fetchMyBots();
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.message });
    } finally {
      setUploading(false);
    }
  };

  // Use template to create bot
  const handleUseTemplate = (tpl) => {
    setBotName(`${tpl.id}_custom`);
    setCodeContent(tpl.code);
    setSelectedTactic(tpl.id.includes('flag') ? 'FLAG_RUSHER' : 'COMBAT_HUNTER');
    setUploadMode('code');
    setActiveSubTab('upload');
  };

  // Download template code as .py
  const downloadCode = (filename, code) => {
    const blob = new Blob([code], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy code to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Đã sao chép mã nguồn thuật toán vào Clipboard! Bạn có thể dán vào file .py hoặc trình soạn thảo.');
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-wide flex items-center gap-2">
            <span>Hồ Sơ & Kho Bot Thuật Toán Sinh Viên (Bot Vault)</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Nộp nhiều bot Python, tùy chỉnh chiến thuật (Cướp Cờ A*, Thủ Căn Cứ, Săn Diệt) và chọn bot chính thức xuất trận
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#0e1322] border border-white/5 self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('vault')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'vault'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Kho Bot Của Tôi ({myBots.length})
          </button>
          <button
            onClick={() => setActiveSubTab('templates')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'templates'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Mẫu thuật toán
          </button>
          <button
            onClick={() => setActiveSubTab('upload')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'upload'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            + Nộp / viết bot mới
          </button>
          <button
            onClick={() => setActiveSubTab('guide')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'guide'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-amber-300'
            }`}
          >
            Hướng dẫn cướp cờ
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
          <button onClick={() => setAlertMsg(null)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* SUB-TAB 1: KHO BOT CỦA TÔI */}
      {activeSubTab === 'vault' && (
        <div className="space-y-6">
          {myBots.length === 0 ? (
            <div className="p-12 rounded-2xl bg-[#0e1322]/80 border border-white/5 backdrop-blur-md text-center space-y-4">
              <div className="empty-state-mark">BOT</div>
              <h3 className="font-bold text-white text-base">Bạn chưa nộp Bot Python nào</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Hãy tham khảo các bản mẫu thuật toán A* Cướp Cờ hoặc Minimax để tạo bot của bạn và giao tranh giành cúp Đại học!
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={() => setActiveSubTab('templates')}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
                >
                  Xem bản mẫu thuật toán
                </button>
                <button
                  onClick={() => setActiveSubTab('upload')}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
                >
                  Tạo bot mới
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {myBots.map((bot) => (
                <div
                  key={bot.id}
                  className={`p-5 rounded-2xl border backdrop-blur-md transition-all duration-300 flex flex-col justify-between ${
                    bot.is_active
                      ? 'bg-indigo-950/40 border-indigo-500/50 shadow-xl shadow-indigo-950/40 ring-1 ring-indigo-500/30'
                      : 'bg-[#0e1322]/80 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="bot-code-mark">BOT</span>
                      {bot.is_active ? (
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          BOT CHÍNH XUẤT TRẬN
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-slate-400">
                          Dự bị
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-white text-base mt-3">{bot.name}</h3>

                    {/* Tactic Selector */}
                    <div className="mt-3 p-2.5 rounded-xl bg-[#090d18] border border-white/5 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <span>Chiến Thuật Thi Đấu:</span>
                        <span className="text-indigo-400">Tùy biến</span>
                      </div>
                      <select
                        value={bot.tactic || 'FLAG_RUSHER'}
                        onChange={(e) => handleChangeTactic(bot.id, e.target.value)}
                        className="w-full bg-[#0c101d] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:ring-1 focus:ring-indigo-500"
                      >
                        {TACTIC_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-3 text-xs text-slate-400 space-y-1">
                      <div className="flex justify-between">
                        <span>Nguồn:</span>
                        <span className="text-slate-300 uppercase font-mono">{bot.source_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Ngày nộp:</span>
                        <span className="text-slate-300">
                          {new Date(bot.created_at).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      {!bot.is_active ? (
                        <button
                          onClick={() => handleActivateBot(bot.id)}
                          className="flex-1 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-1"
                        >
                          <span>⭐</span>
                          <span>Chọn Làm Bot Chính</span>
                        </button>
                      ) : (
                        <div className="flex-1 text-center py-1.5 text-xs font-bold text-emerald-300 bg-emerald-950/30 rounded-xl border border-emerald-500/20">
                          ✓ Đang Thi Đấu
                        </div>
                      )}

                      <button
                        onClick={() => handleDeleteBot(bot.id, bot.name)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 text-xs transition-colors"
                        title="Xóa Bot"
                      >
                        Xóa
                      </button>
                    </div>

                    <button
                      onClick={async () => {
                        setUploading(true);
                        setAlertMsg(null);
                        try {
                          const res = await fetch('/api/game/bot-vs-bot', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                            body: JSON.stringify({ bot1Id: bot.id, bot2Level: 'MEDIUM', boardSize: 9 }),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.message);
                          const m = data.data;
                          setAlertMsg({
                            type: 'success',
                            text: `Đấu thử xong! ${m.winner === 1 ? 'Bot THẮNG' : 'Bot THUA'} Boss (${m.winReason}) sau ${m.totalTurns} lượt cờ.`,
                          });
                        } catch (err) {
                          setAlertMsg({ type: 'error', text: `Lỗi chạy thử: ${err.message}` });
                        } finally {
                          setUploading(false);
                        }
                      }}
                      className="w-full py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>Chạy Đấu Thử Máy Ngay</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: BẢN MẪU THUẬT TOÁN (ALPHA-BETA, A*, HEURISTIC) */}
      {activeSubTab === 'templates' && (
        <div className="space-y-6">
          {/* Template Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {templates.map((tpl) => {
              const isSelected = selectedTemplate?.id === tpl.id;
              return (
                <div
                  key={tpl.id}
                  onClick={() => setSelectedTemplate(tpl)}
                  className={`p-5 rounded-2xl border cursor-pointer backdrop-blur-md transition-all duration-300 ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500 shadow-xl shadow-indigo-950/40 scale-[1.01]'
                      : 'bg-[#0e1322]/80 border-white/5 hover:border-white/10 opacity-80 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">
                      {tpl.id.includes('flag') ? 'A*' : tpl.id.includes('minimax') ? 'MM' : 'HX'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-300">
                      Python 3
                    </span>
                  </div>

                  <h3 className="font-bold text-white text-sm mt-3">{tpl.name}</h3>
                  <div className="text-[11px] font-semibold text-indigo-400 mt-1">{tpl.algorithm}</div>
                  <p className="text-xs text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                    {tpl.description}
                  </p>

                  <div className="mt-4 pt-3 border-t border-white/5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUseTemplate(tpl);
                      }}
                      className="w-full py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white font-bold text-xs transition-colors"
                    >
                      Dùng Mẫu Này Tạo Bot →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Code Viewer Card */}
          {selectedTemplate && (
            <div className="rounded-2xl bg-[#090d18] border border-white/5 overflow-hidden shadow-2xl">
              <div className="px-5 py-3.5 bg-[#0e1322] border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500/80"></span>
                  <span className="w-3 h-3 rounded-full bg-yellow-500/80"></span>
                  <span className="w-3 h-3 rounded-full bg-green-500/80"></span>
                  <span className="ml-2 font-mono text-xs text-slate-300 font-bold">
                    {selectedTemplate.filename}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUseTemplate(selectedTemplate)}
                    className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-xs shadow transition-all flex items-center gap-1.5"
                  >
                    <span>Tạo Bot Từ Mẫu Này</span>
                  </button>
                  <button
                    onClick={() => copyToClipboard(selectedTemplate.code)}
                    className="px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-medium text-xs border border-white/10 transition-colors flex items-center gap-1.5"
                  >
                    <span>Sao Chép</span>
                  </button>
                  <button
                    onClick={() => downloadCode(selectedTemplate.filename, selectedTemplate.code)}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-colors flex items-center gap-1.5"
                  >
                    <span>Tải File .py</span>
                  </button>
                </div>
              </div>

              <pre className="p-5 overflow-x-auto text-xs font-mono text-slate-200 leading-relaxed max-h-[500px] scrollbar-thin select-all">
                <code>{selectedTemplate.code}</code>
              </pre>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: NỘP HOẶC SOẠN THẢO BOT MỚI */}
      {activeSubTab === 'upload' && (
        <div className="max-w-3xl mx-auto p-6 rounded-2xl bg-[#0e1322]/80 border border-white/5 backdrop-blur-md space-y-6">
          <div>
            <h3 className="font-bold text-lg text-white">Nộp & Tùy Biến Thuật Toán Bot Python Mới</h3>
            <p className="text-xs text-slate-400 mt-1">
              Hệ thống sẽ biên dịch và kiểm tra cú pháp tự động trước khi nạp vào máy chấm phân tán (Judge Worker)
            </p>
          </div>

          {/* Mode switch */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setUploadMode('code')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                uploadMode === 'code'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              Dán / soạn thảo code Python
            </button>
            <button
              type="button"
              onClick={() => setUploadMode('file')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                uploadMode === 'file'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              Tải lên file .py
            </button>
            <button
              type="button"
              onClick={() => setUploadMode('git')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                uploadMode === 'git'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              Git repository URL
            </button>
          </div>

          <form onSubmit={handleSubmitBot} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Tên Chiến Binh Bot
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: FlagRusher_Pro_K21 hoặc Minimax_Titan"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#090d18] border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Chiến Thuật Chủ Đạo
                </label>
                <select
                  value={selectedTactic}
                  onChange={(e) => setSelectedTactic(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#090d18] border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500 font-medium"
                >
                  {TACTIC_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {uploadMode === 'code' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Mã Nguồn Python (.py)
                  </label>
                  <div className="flex gap-2">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setCodeContent(t.code)}
                        className="text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-indigo-300 transition-colors"
                      >
                        Nạp {t.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  rows={16}
                  value={codeContent}
                  onChange={(e) => setCodeContent(e.target.value)}
                  placeholder="# Nhập hoặc dán mã nguồn Python bot tại đây..."
                  className="w-full p-4 rounded-xl bg-[#090d18] border border-white/10 font-mono text-xs text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed scrollbar-thin"
                  required
                />
              </div>
            )}

            {uploadMode === 'file' && (
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Chọn File .py
                </label>
                <input
                  type="file"
                  accept=".py"
                  onChange={(e) => setSelectedFile(e.target.files[0] || null)}
                  className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                  required
                />
              </div>
            )}

            {uploadMode === 'git' && (
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Git Repository URL
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/username/battlecode-rps-bot.git"
                  value={gitUrl}
                  onChange={(e) => setGitUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#090d18] border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={uploading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 disabled:opacity-50 text-white font-bold text-xs shadow-xl shadow-indigo-950/40 transition-all flex items-center justify-center gap-2"
              >
                <span>{uploading ? 'Đang Kiểm Tra Cú Pháp & Kích Hoạt...' : 'Xác Nhận Nạp Bot Lên Sàn Đấu'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUB-TAB 4: HƯỚNG DẪN LẬP TRÌNH CƯỚP CỜ */}
      {activeSubTab === 'guide' && (
        <div className="p-8 rounded-2xl bg-[#0e1322]/80 border border-white/5 backdrop-blur-md space-y-6 text-slate-300 text-sm leading-relaxed">
          <div className="border-b border-white/10 pb-4">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <span>CẨM NANG THUẬT TOÁN BOT CƯỚP CỜ (CAPTURE THE FLAG)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Dành cho Sinh viên Đại học ngành CNTT, Kỹ thuật Phần mềm và Trí tuệ Nhân tạo
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl bg-[#090d18] border border-white/5 space-y-3">
              <h3 className="font-bold text-amber-300 text-sm flex items-center gap-2">
                <span>Luật Cướp Cờ Thắng Tuyệt Đối</span>
              </h3>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-300">
                <li>
                  <strong>Phe 1 (Xanh)</strong>: Cờ nhà tại <code className="text-cyan-400 font-mono">(0, 0)</code>. Di chuyển bất kỳ quân nào đến <strong>Căn cứ Cờ Phe 2 tại <code className="text-rose-400 font-mono">(8, 8)</code></strong> (hoặc hàng cuối) -&gt; <strong>THẮNG NGAY LẬP TỨC!</strong>
                </li>
                <li>
                  <strong>Phe 2 (Đỏ)</strong>: Cờ nhà tại <code className="text-rose-400 font-mono">(8, 8)</code>. Di chuyển đến <strong>Căn cứ Cờ Phe 1 tại <code className="text-cyan-400 font-mono">(0, 0)</code></strong> -&gt; <strong>THẮNG NGAY LẬP TỨC!</strong>
                </li>
                <li>
                  Nếu quét sạch toàn bộ quân cờ đối phương, bạn cũng giành chiến thắng tuyệt đối.
                </li>
              </ul>
            </div>

            <div className="p-5 rounded-xl bg-[#090d18] border border-white/5 space-y-3">
              <h3 className="font-bold text-sky-300 text-sm flex items-center gap-2">
                <span>Bình Bảo Vật & Chướng Ngại Vật</span>
              </h3>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-300">
                <li>
                  <strong>Bình Đi 2 Bước (POTION_SPEED)</strong>: Cho phép bứt tốc 2 ô thẳng hoặc 1 ô chéo ở lượt sau, cực kỳ lợi hại để lao vào cướp cờ đối phương!
                </li>
                <li>
                  <strong>Bình Đồng Hóa (POTION_INFECTION)</strong>: Khi ăn quân địch, biến quân đó thành đồng minh phe mình thay vì tiêu diệt.
                </li>
                <li>
                  <strong>Bình Nhân Bản (POTION_CLONE)</strong>: Tự động phân thân thêm 1 quân cùng hệ ở ô liền kề.
                </li>
                <li>
                  <strong>Vật Cản (OBSTACLE)</strong>: Không thể đi vào hoặc đi xuyên qua.
                </li>
              </ul>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-[#090d18] border border-white/5 space-y-2 font-mono text-xs">
            <h4 className="text-white font-bold font-sans text-sm">Chuẩn I/O của Bot Python:</h4>
            <p className="text-slate-400 font-sans">
              Bot đọc dữ liệu JSON từ <strong>STDIN</strong> và in đúng 1 dòng JSON nước đi ra <strong>STDOUT</strong>:
            </p>
            <pre className="p-3 bg-[#0c101d] rounded-lg text-emerald-400 overflow-x-auto">
              {"{\"fromRow\": 0, \"fromCol\": 0, \"toRow\": 1, \"toCol\": 0}"}
            </pre>
            <p className="text-slate-500 font-sans text-[11px]">
              * Giới hạn thời gian: tối đa <strong>1.0 giây/nước đi</strong>. Nếu quá giờ hoặc lặp vô hạn sẽ bị xử thua lập tức.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
