import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import GameBoard from './GameBoard';

export default function PvPBotArenaView({ onSelectReplay, preselectedOpponent = null, onOpenBots }) {
  const { user, getAuthHeaders } = useAuth();

  const [players, setPlayers] = useState([]);
  const [selectedOpponentId, setSelectedOpponentId] = useState(preselectedOpponent?.id || '');
  const [boardSize, setBoardSize] = useState(9);
  const [loading, setLoading] = useState(false);
  const [botsLoading, setBotsLoading] = useState(true);
  const [selectionError, setSelectionError] = useState('');
  const [autoMatchData, setAutoMatchData] = useState(null);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playSpeed, setPlaySpeed] = useState(1);
  const timerRef = useRef(null);

  const loadPlayers = async (isCancelled = () => false) => {
    setBotsLoading(true);
    setSelectionError('');
    try {
      const response = await fetch('/api/bots/players');
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Không tải được danh sách người chơi.');
      if (isCancelled()) return;
      const list = data.data || [];
      setPlayers(list);
      setSelectedOpponentId(current => list.some(player => player.id === current && player.id !== user?.id)
        ? current : list.find(player => player.id !== user?.id)?.id || '');
    } catch (error) {
      if (!isCancelled()) setSelectionError(error.message);
    } finally {
      if (!isCancelled()) setBotsLoading(false);
    }
  };
  useEffect(() => {
    let cancelled = false;
    loadPlayers(() => cancelled);
    return () => { cancelled = true; };
  }, [user?.id]);
  useEffect(() => {
    if (preselectedOpponent?.id && preselectedOpponent.id !== user?.id) setSelectedOpponentId(preselectedOpponent.id);
  }, [preselectedOpponent?.id, user?.id]);

  const replaySteps = autoMatchData?.replay?.steps || [];
  const totalSteps = replaySteps.length;
  const opponents = players.filter(player => player.id !== user?.id);
  const selectedOpponent = opponents.find(player => player.id === selectedOpponentId);
  const ownProfile = players.find(player => player.id === user?.id);
  const canStart = Boolean(user && ownProfile?.ready && selectedOpponent?.ready);
  // Autoplay step timer

  useEffect(() => {
    if (autoMatchData && isPlaying && totalSteps > 0) {
      const intervalMs = Math.max(120, 700 / playSpeed);
      timerRef.current = setInterval(() => {
        setCurrentStepIdx((prev) => {
          if (prev >= totalSteps - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoMatchData, isPlaying, playSpeed, totalSteps]);

  const handlePickRandomOpponent = () => {
    const others = opponents.filter(player => player.id !== selectedOpponentId);
    if (others.length) setSelectedOpponentId(others[Math.floor(Math.random()*others.length)].id);
  };
  const handleStartPvPDuel = async () => {
    if (!canStart) return;
    setLoading(true);
    setSelectionError('');
    setAutoMatchData(null);
    setCurrentStepIdx(0);
    setIsPlaying(true);
    try {
      const response = await fetch('/api/game/pvp', {
        method:'POST',
        headers:{'Content-Type':'application/json',...getAuthHeaders()},
        body:JSON.stringify({opponentUserId:selectedOpponentId,boardSize}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Không thể tạo trận đấu PvP.');
      setAutoMatchData(data.data);
    } catch (error) {
      setSelectionError(error.message);
    } finally { setLoading(false); }
  };
  const currentStep = replaySteps[currentStepIdx] || null;
  const currentGrid =
    currentStep?.boardSnapshot ||
    autoMatchData?.replay?.steps?.[currentStepIdx]?.boardSnapshot ||
    autoMatchData?.replay?.initialBoard ||
    autoMatchData?.replay?.steps?.[0]?.boardSnapshot ||
    [];

  return (
    <div className="view-shell animate-fadeIn">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-white tracking-wide flex items-center gap-2">
              <span>Đấu bot PvP</span>
            </h1>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white uppercase tracking-wider">
              100% NGƯỜI THẬT
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            Chế độ độc lập hoàn toàn giữa 2 sinh viên thật. Chọn người chơi đối thủ. Hai bên tự động dùng bot chính do chính chủ kích hoạt để so tài theo luật Kéo - Búa - Bao & Cướp Cờ!
          </p>
        </div>

        {autoMatchData && (
          <button
            onClick={() => setAutoMatchData(null)}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors self-start sm:self-auto"
          >
            ← Chọn Cặp Đấu Khác
          </button>
        )}
      </div>

      {!autoMatchData ? (
        /* Setup PvP Match */
        <div className="space-y-6">
          {selectionError && <p role="alert" className="text-sm text-red-300">{selectionError}</p>}
          <div className="rounded-2xl border border-blue-500/30 bg-[#0e1322]/80 p-5 space-y-3">
            <label htmlFor="pvp-opponent" className="block text-sm font-bold text-blue-300">Bạn (phe Xanh) chọn đối thủ</label>
            <div className="flex flex-wrap items-center gap-3">
              <select id="pvp-opponent" aria-label="Người chơi đối thủ" value={selectedOpponentId}
                onChange={event => setSelectedOpponentId(event.target.value)}
                className="min-w-0 flex-1 py-2.5 px-3 rounded-xl bg-[#090d18] border border-blue-500/20 text-white text-xs font-semibold">
                <option value="" disabled>{botsLoading ? 'Đang tải người chơi...' : 'Chọn người chơi'}</option>
                {opponents.map(player => <option key={player.id} value={player.id}>{player.username} ({player.elo_rating} Elo){player.ready ? '' : ' — Chưa sẵn sàng'}</option>)}
              </select>
              <button type="button" onClick={handlePickRandomOpponent}
                disabled={opponents.length < 2 || botsLoading}
                title={opponents.length > 1 ? 'Chọn một người khác' : 'Chưa có người chơi khác để đổi'}
                className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/5">
                Đổi ngẫu nhiên
              </button>
              <button type="button" onClick={() => loadPlayers()} disabled={botsLoading} className="text-xs text-cyan-300 underline">Làm mới danh sách và bot chính</button>
            </div>
            <p className="text-xs text-slate-400">Người bạn chọn sẽ xuất hiện ở phe Đỏ bên dưới, cùng bot chính do họ kích hoạt.</p>
            {!botsLoading && !opponents.length && <p className="text-xs text-slate-400">Chưa có người chơi khác đăng ký.</p>}
          </div>
          {/* Duelists Cards: Player 1 VS Player 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 items-center">
            {/* Player 1 Card (Blue Team) */}
            <div className="lg:col-span-5 p-6 rounded-2xl bg-gradient-to-br from-blue-950/40 via-[#0e1322] to-[#090d18] border border-blue-500/30 shadow-xl shadow-blue-950/20 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                  PHE XANH (CĂN CỨ 0,0)
                </span>
                <span className="text-xs font-mono font-bold text-slate-400">
                  {user?.elo_rating || 1200} Elo
                </span>
              </div>

              <div className="flex items-center gap-3.5 pt-1">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-xl font-black text-white shadow-lg shadow-blue-500/30">
                  {user?.username ? user.username.charAt(0).toUpperCase() : 'B'}
                </div>
                <div>
                  <div className="font-extrabold text-white text-base">
                    {user?.username || 'Bạn (Sinh Viên 1)'}
                  </div>
                  <div className="text-[11px] text-blue-300 font-semibold mt-0.5">
                    Bạn — người thách đấu
                  </div>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <p className="text-[11px] font-bold text-slate-400 uppercase">Bot chính của bạn</p>
                <p className="text-sm font-semibold text-white">{ownProfile?.bot?.name || 'Chưa chọn bot chính'}</p>
                <p className="text-xs text-slate-400">{ownProfile?.ready ? 'Chạy nguyên mã nguồn bạn đã nộp.' : ownProfile?.reason || 'Vào Kho bot để nộp và kích hoạt bot của bạn.'}</p>
                <button type="button" onClick={onOpenBots} className="text-xs text-cyan-300 underline">Vào Kho bot chọn bot chính</button>
              </div>
            </div>
            {/* VS Divider */}
            <div className="lg:col-span-1 flex flex-col items-center justify-center py-2">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-red-500 flex items-center justify-center text-slate-950 font-black text-sm shadow-xl shadow-red-500/20 ring-4 ring-[#080b14]">
                VS
              </div>
            </div>

            {/* Player 2 Card (Red Team) */}
            <div className="lg:col-span-5 p-6 rounded-2xl bg-gradient-to-br from-red-950/40 via-[#0e1322] to-[#090d18] border border-red-500/30 shadow-xl shadow-red-950/20 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                  PHE ĐỎ (CĂN CỨ {boardSize-1},{boardSize-1})
                </span>
                <span className="text-xs font-mono font-bold text-slate-400">
                  {selectedOpponent?.elo_rating ?? '—'} Elo
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-red-600 to-orange-500 flex items-center justify-center text-xl font-black text-white shadow-lg shadow-red-500/30">
                    {selectedOpponent?.username ? selectedOpponent.username.charAt(0).toUpperCase() : 'O'}
                  </div>
                  <div>
                    <div className="font-extrabold text-white text-base">
                      {selectedOpponent?.username || 'Sinh Viên Đối Thủ'}
                    </div>
                    <div className="text-[11px] text-red-300 font-semibold mt-0.5">
                      Đối thủ bạn đã chọn
                    </div>
                  </div>
                </div>

              </div>

              <div className="pt-2 space-y-2">
                <p className="text-xs text-slate-300">Bot chính: <strong>{selectedOpponent?.bot?.name || 'Chưa chọn'}</strong></p>
                <p className="text-xs text-slate-400">{selectedOpponent?.ready ? 'Bot do chính người chơi này kích hoạt. Bạn không thể đổi bot hộ họ.' : selectedOpponent?.reason || 'Chọn người chơi để xem bot chính của họ.'}</p>
              </div>
            </div>
          </div>
          {/* Match Settings & Launch Button */}
          <div className="p-6 rounded-2xl bg-[#0e1322]/80 border border-white/5 backdrop-blur-md grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Kích Thước Bàn Cờ Thi Đấu
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[8, 9].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setBoardSize(size)}
                    className={`py-3 px-4 rounded-xl border font-bold text-xs transition-all ${
                      boardSize === size
                        ? 'bg-cyan-600 text-white border-cyan-500 shadow-md'
                        : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                    }`}
                  >
                    Bàn {size}x{size} {size === 9 ? '(Chuẩn Đại Học)' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                <span>Luật Cướp Cờ:</span> Bên nào chạm ô (0,0) hoặc ({boardSize-1},{boardSize-1}) trước thắng ngay.
              </div>
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                <span>Luật Oẳn Tù Tì:</span> Kéo ăn Bao, Búa ăn Kéo, Bao ăn Búa.
              </div>
            </div>

            <div>
              <button
                onClick={handleStartPvPDuel}
                disabled={loading || botsLoading || !canStart}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-sm shadow-xl shadow-cyan-950/50 transition-all flex items-center justify-center gap-2 tracking-wide"
              >
                <span>{loading ? 'Đang Khởi Chạy 2 Bot Python...' : 'KHỞI TRANH ĐẤU BOT 2 NGƯỜI (PvP)'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* PvP Live Match / Replay Player */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Board & Playback Controls (Cols 2) */}
          <div className="lg:col-span-2 flex flex-col items-center">
            {/* Header info */}
            <div className="w-full mb-3 flex items-center justify-between text-xs px-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
                <span className="font-bold text-blue-300">{autoMatchData.p1Name} ({autoMatchData.p1BotName})</span>
              </div>
              <div className="font-mono font-bold text-slate-400 text-xs">
                Lượt {currentStepIdx} / {totalSteps}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-red-300">{autoMatchData.p2Name}</span>
                <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
              </div>
            </div>

            {/* Game Board */}
            <GameBoard
              size={boardSize}
              grid={currentGrid}
              lastMove={currentStep?.move}
              disabled={true}
            />

            {/* Turn Slider Controls */}
            <div className="w-full mt-4 p-4 rounded-2xl bg-[#0e1322]/80 border border-white/5 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-slate-400">0</span>
                <input
                  type="range"
                  min="0"
                  max={Math.max(0, totalSteps - 1)}
                  value={currentStepIdx}
                  onChange={(e) => {
                    setCurrentStepIdx(parseInt(e.target.value, 10));
                    setIsPlaying(false);
                  }}
                  className="flex-1 accent-cyan-500 h-1.5 rounded-lg cursor-pointer bg-slate-800"
                />
                <span className="text-[11px] font-mono text-slate-400">{totalSteps}</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition-colors flex items-center gap-1.5"
                  >
                    <span>{isPlaying ? '⏸️ Tạm Dừng' : '▶️ Tự Động Chạy'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setCurrentStepIdx(totalSteps - 1);
                      setIsPlaying(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
                  >
                    Tua Tới Kết Thúc ⏭️
                  </button>
                </div>

                {/* Speed buttons */}
                <div className="flex items-center gap-1">
                  {[1, 2, 4].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setPlaySpeed(speed)}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors ${
                        playSpeed === speed ? 'bg-cyan-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Result Announcement */}
            {currentStepIdx >= totalSteps - 1 && (
              <div className="w-full mt-4 p-5 rounded-2xl bg-gradient-to-r from-blue-950/60 via-indigo-950/60 to-purple-950/60 border border-cyan-500/30 text-center space-y-2.5 shadow-2xl">
                <h3 className="font-black text-lg text-white">
                  CHIẾN THẮNG: {autoMatchData.winnerName}!
                </h3>
                <p className="text-xs text-slate-300">
                  Kết quả: <strong className="text-amber-300">
                    {autoMatchData.winReason === 'FLAG_CAPTURE'
                      ? 'CƯỚP CỜ THÀNH CÔNG (Chiếm căn cứ đối phương)'
                      : autoMatchData.winReason === 'ELIMINATION'
                      ? 'Tiêu diệt toàn bộ quân địch'
                      : autoMatchData.winReason === 'MAX_TURNS_REACHED'
                      ? '⏱️ Hết 150 lượt (Bên nhiều quân hơn thắng)'
                      : autoMatchData.winReason}
                  </strong> trong {autoMatchData.totalTurns} lượt cờ giữa 2 sinh viên.
                </p>

                {onSelectReplay && (
                  <button
                    onClick={() => onSelectReplay(autoMatchData.replay)}
                    className="mt-2 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition-colors"
                  >
                    Mở trình phân tích replay
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Combat Log Panel (Col 1) */}
          <div className="rounded-2xl bg-[#0e1322]/80 border border-white/5 p-5 backdrop-blur-md h-[550px] flex flex-col">
            <h3 className="font-bold text-sm text-white pb-3 border-b border-white/5 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span>Nhật Ký Từng Bước Của 2 Bot</span>
              </span>
              <span className="text-[11px] font-mono text-cyan-400">{replaySteps.length} bước</span>
            </h3>

            <div className="flex-1 overflow-y-auto py-3 space-y-2 scrollbar-thin font-mono text-xs">
              {replaySteps.slice(0, currentStepIdx + 1).map((step, idx) => {
                const isP1 = step.player === 1;
                return (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border leading-relaxed ${
                      step.combat
                        ? 'bg-purple-950/30 border-purple-500/20 text-purple-300'
                        : isP1
                        ? 'bg-blue-950/20 border-blue-500/20 text-blue-200'
                        : 'bg-red-950/20 border-red-500/20 text-red-200'
                    }`}
                  >
                    <div className="text-[10px] text-slate-500 flex justify-between">
                      <span className={isP1 ? 'text-blue-400 font-bold' : 'text-rose-400 font-bold'}>
                        Lượt #{step.step} - {isP1 ? `Phe Xanh (${autoMatchData.p1Name})` : `Phe Đỏ (${autoMatchData.p2Name})`}
                      </span>
                      <span>{step.executionTimeMs || 0}ms</span>
                    </div>

                    <div className="mt-1 font-semibold text-slate-200">
                      Đi ({step.move.fromRow}, {step.move.fromCol}) → ({step.move.toRow}, {step.move.toCol})
                    </div>

                    {step.combat && (
                      <div className="text-[11px] mt-1 text-amber-300 font-sans">
                        Giao tranh: {step.combat.attacker?.type} vs {step.combat.defender?.type} → {step.combat.outcome}
                      </div>
                    )}

                    {step.itemCollected && (
                      <div className="text-[10px] mt-0.5 text-emerald-300 font-sans">
                        Nhặt vật phẩm: {step.itemCollected.type}
                      </div>
                    )}

                    {step.warning && (
                      <div className="text-[10px] mt-1 text-amber-400 bg-amber-500/10 p-1 rounded border border-amber-500/20 font-sans">
                        {step.warning}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
