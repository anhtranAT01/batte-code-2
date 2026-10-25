import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import GameBoard from './GameBoard';
import { runDuel, applyDuelEvent } from '../lib/duelStream';
import { invalidatePublicData } from '../lib/publicData';

export default function BossArenaView({ onSelectReplay }) {
  const { user, getAuthHeaders } = useAuth();

  const [bosses] = useState([
    {
      id: 'EASY',
      name: 'Tân Thủ Heuristic',
      tier: 'ĐỒNG',
      avatar: '01',
      difficulty: 'easy',
      description: 'Bot AI sử dụng hàm đánh giá Heuristic cơ bản, ưu tiên ăn quân đối phương và nhặt vật phẩm kề bên.',
      color: 'from-amber-800/40 to-orange-900/30 border-amber-600/40',
      tagColor: 'bg-amber-900/60 text-amber-300',
    },
    {
      id: 'MEDIUM',
      name: 'Sát Thủ Tốc Độ',
      tier: 'BẠC',
      avatar: '02',
      difficulty: 'medium',
      description: 'Bot AI phản xạ nhanh, ưu tiên chiếm lĩnh bình Tăng Tốc để nhảy 2 bước đánh úp hàng ngũ đối phương.',
      color: 'from-blue-900/40 to-cyan-900/30 border-cyan-500/40',
      tagColor: 'bg-cyan-900/60 text-cyan-300',
    },
    {
      id: 'HARD',
      name: 'Bậc Thầy Alpha-Beta',
      tier: 'VÀNG',
      avatar: '03',
      difficulty: 'hard',
      description: 'Minimax kết hợp tỉa nhánh Alpha-Beta, mô phỏng 3 lượt: mình, đối thủ, mình. Ưu tiên bảo vệ cờ và bảo toàn lực lượng.',
      color: 'from-yellow-900/40 to-amber-900/30 border-yellow-500/40',
      tagColor: 'bg-yellow-900/60 text-yellow-300',
    },
    {
      id: 'GRANDMASTER',
      name: 'Đại Sư A* Flag Rusher',
      tier: 'KIM CƯƠNG',
      avatar: '04',
      difficulty: 'hard',
      description: 'Thuật toán A* Heuristic Pathfinding lao cờ, tính toán đường đi ngắn nhất né tránh khắc chế để cướp cứ điểm.',
      color: 'from-purple-900/40 to-pink-900/30 border-pink-500/40',
      tagColor: 'bg-purple-900/60 text-pink-300',
    },
  ]);

  const [selectedBoss, setSelectedBoss] = useState(bosses[1]);
  const [boardSize, setBoardSize] = useState(9);
  const [myBots, setMyBots] = useState([]);
  const [selectedBotId, setSelectedBotId] = useState('template_alphabeta');
  const [loading, setLoading] = useState(false);
  const [matchError, setMatchError] = useState('');

  // Auto match execution states
  const [autoMatchData, setAutoMatchData] = useState(null);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playSpeed, setPlaySpeed] = useState(1); // 1x, 2x, 4x
  const timerRef = useRef(null);
  const requestRef = useRef(null);
  const playbackRef = useRef({totalSteps:0,loading:false});
  const [queuePosition,setQueuePosition] = useState(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  const leaveMatch = () => { requestRef.current?.abort(); setAutoMatchData(null); };
  const receiveProgress = event => {
    if (event.type === 'queued') setQueuePosition(event.data.position);
    else setAutoMatchData(current => applyDuelEvent(current,event));
  };

  // Fetch student bots
  useEffect(() => {
    let cancelled = false;
    if (user) {
      fetch('/api/bots/my-bots', { headers: getAuthHeaders() })
        .then((res) => (res.ok ? res.json() : { data: [] }))
        .then((data) => {
          if (cancelled) return;
          const list = data.data || [];
          setMyBots(list);
          setSelectedBotId((current) => current.startsWith('template_') || list.some((bot) => bot.id === current)
            ? current : 'template_alphabeta');
        })
        .catch(console.warn);
    }
    return () => { cancelled = true; };
  }, [user?.id]);

  // Autoplay step timer
  const replaySteps = autoMatchData?.replay?.steps || [];
  const totalSteps = replaySteps.length;
  playbackRef.current = {totalSteps,loading};

  useEffect(() => {
    if (autoMatchData && isPlaying) {
      const intervalMs = Math.max(150, 700 / playSpeed);
      timerRef.current = setInterval(() => {
        setCurrentStepIdx((prev) => {
          if (prev >= playbackRef.current.totalSteps - 1) {
            if (!playbackRef.current.loading) setIsPlaying(false);
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
  }, [Boolean(autoMatchData), isPlaying, playSpeed]);

  // Start Automated Bot Duel
  const handleStartAutoDuel = async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setQueuePosition(null);
    setLoading(true);
    setMatchError('');
    setAutoMatchData(null);
    setCurrentStepIdx(0);
    setIsPlaying(true);

    try {
      const result = await runDuel('/api/game/bot-vs-bot', {
        body: {
          bot1Id: selectedBotId,
          bot2Level: selectedBoss.id,
          boardSize,
          difficulty: selectedBoss.difficulty,
        },
        headers: getAuthHeaders(),
        signal: controller.signal,
        onUpdate: receiveProgress,
      });
      if (controller.signal.aborted) return;
      setAutoMatchData(result);
      invalidatePublicData();
    } catch (err) {
      if (!controller.signal.aborted) setMatchError(`Không thể tiếp tục trận: ${err.message}`);
    } finally {
      if (requestRef.current === controller) setLoading(false);
    }
  };

  const currentStep = replaySteps[currentStepIdx] || null;
  const currentGrid =
    currentStep?.boardSnapshot ||
    autoMatchData?.replay?.steps?.[currentStepIdx]?.boardSnapshot ||
    autoMatchData?.replay?.initialBoard ||
    autoMatchData?.replay?.steps?.[0]?.boardSnapshot ||
    [];

  return (
    <div className="view-shell animate-fadeIn max-w-7xl mx-auto">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-wide">
              Thử thách chiến thuật
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white uppercase">
              HOT
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Chọn bot của bạn để tự động giao tranh với Boss AI. Bàn cờ hiện ngay khi bắt đầu, nước đi được cập nhật trong lúc bot tính toán.
          </p>
        </div>

        {autoMatchData && (
          <button
            onClick={leaveMatch}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors self-start sm:self-auto"
          >
            ← Chọn Boss & Cấu Hình Khác
          </button>
        )}
      </div>

      {matchError && <p role="alert" className="rounded-xl border border-red-500/30 p-3 mb-4 text-sm text-red-300">{matchError}</p>}
      {loading && <p role="status" className="text-sm text-slate-400 mb-4">{queuePosition && !autoMatchData
        ? `Đang xếp hàng: vị trí ${queuePosition}. Máy chủ sẽ mở bàn cờ khi đến lượt.`
        : autoMatchData ? `Bot đang tính tiếp · đã có ${totalSteps} lượt. Bạn có thể xem ngay hoặc tạm dừng.`
        : 'Đang kết nối và chuẩn bị bàn cờ…'}</p>}
      {loading && !autoMatchData && <button type="button" onClick={leaveMatch} className="mb-4 text-xs text-cyan-300 underline">Hủy chờ</button>}
      {!autoMatchData ? (
        /* Setup & Selection View */
        <div className="space-y-6">
          {/* Boss Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {bosses.map((boss) => {
              const isSelected = selectedBoss.id === boss.id;
              return (
                <div
                  key={boss.id}
                  onClick={() => setSelectedBoss(boss)}
                  className={`cursor-pointer rounded-2xl p-5 border transition-all duration-300 bg-gradient-to-b ${boss.color} backdrop-blur-md relative overflow-hidden group ${
                    isSelected
                      ? 'ring-2 ring-indigo-400 shadow-xl shadow-indigo-950/50 scale-[1.02]'
                      : 'hover:-translate-y-1 opacity-80 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-3xl">{boss.avatar}</span>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${boss.tagColor}`}>
                      {boss.tier}
                    </span>
                  </div>

                  <h3 className="font-bold text-white text-base mt-3 group-hover:text-indigo-300 transition-colors">
                    {boss.name}
                  </h3>
                  <p className="text-xs text-slate-300 mt-2 line-clamp-3 leading-relaxed">
                    {boss.description}
                  </p>

                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-400">Độ khó:</span>
                    <span className="text-white uppercase font-bold">{boss.difficulty}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Config Box */}
          <div className="p-6 rounded-2xl bg-[#0e1322]/80 border border-white/5 backdrop-blur-md grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Board size */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Kích Thước Bàn Cờ
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[8, 9].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setBoardSize(size)}
                    className={`py-3 px-4 rounded-xl border font-bold text-sm transition-all ${
                      boardSize === size
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                        : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                    }`}
                  >
                    Bàn {size}x{size}
                  </button>
                ))}
              </div>
            </div>

            {/* Select bot */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Chọn Thuật Toán Bot Của Bạn
              </label>
              <select
                value={selectedBotId}
                onChange={(e) => setSelectedBotId(e.target.value)}
                className="w-full py-3 px-3 rounded-xl bg-[#090d18] border border-white/10 text-white text-xs font-medium focus:outline-none focus:border-indigo-500"
              >
                <optgroup label="Bản Mẫu Thuật Toán Chuẩn">
                  <option value="template_alphabeta">Minimax Alpha-Beta Pruning Bot</option>
                  <option value="template_astar">A* Flag Rusher Bot</option>
                  <option value="template_heuristic">Heuristic Starter Bot</option>
                  <option value="template_speed">Sát Thủ Tốc Độ</option>
                </optgroup>
                {myBots.length > 0 && (
                  <optgroup label="Kho Bot Học Sinh Của Bạn">
                    {myBots.map((bot) => (
                      <option key={bot.id} value={bot.id} disabled={bot.is_available === false}>
                        {bot.name} {bot.is_available === false ? '(Cần tải lại file)' : bot.is_active ? '(Chính thức)' : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Mỗi lượt chọn một quân theo thuật toán. Nhật ký hiển thị thuật toán và mục tiêu của nước đi.
              </p>
            </div>

            {/* Launch button */}
            <div className="flex flex-col justify-end">
              <button
                onClick={handleStartAutoDuel}
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 disabled:opacity-50 text-white font-bold text-sm shadow-xl shadow-indigo-950/50 transition-all flex items-center justify-center gap-2"
              >
                <span>{loading ? 'Đang Chạy Mô Phỏng Bot...' : `Khởi Tranh Tự Động vs ${selectedBoss.name}`}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Automated Live Playback Arena */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Board View */}
          <div className="lg:col-span-2 rounded-2xl bg-[#0e1322]/80 border border-white/5 p-6 backdrop-blur-md flex flex-col items-center">
            {/* Top match header */}
            <div className="w-full flex items-center justify-between mb-4 pb-3 border-b border-white/5 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <span className="font-bold text-white">{autoMatchData.p1Name}</span>
                <span className="text-slate-400">({autoMatchData.p1BotName})</span>
              </div>
              <div className="px-3 py-1 rounded bg-[#090d18] border border-white/10 font-mono font-bold text-amber-400">
                Lượt: {currentStepIdx + 1} / {totalSteps}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">{autoMatchData.p2Name}</span>
                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              </div>
            </div>

            {/* Visual Board */}
            <GameBoard
              grid={currentGrid}
              lastMove={currentStep?.move}
              board={currentGrid}
              validMoves={[]}
              readOnly={true}
              isInteractive={false}
            />

            {/* Playback Controls */}
            <div className="w-full mt-6 p-4 rounded-xl bg-[#090d18] border border-white/5 space-y-3">
              {/* Slider */}
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
                  className="flex-1 accent-indigo-500 h-1.5 rounded-lg cursor-pointer bg-slate-800"
                />
                <span className="text-[11px] font-mono text-slate-400">{totalSteps}</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-colors flex items-center gap-1.5"
                  >
                    <span>{isPlaying ? '⏸️ Tạm Dừng' : '▶️ Tự Động Chạy'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setCurrentStepIdx(Math.max(0,totalSteps - 1));
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
                        playSpeed === speed ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Result Announcement */}
            {!loading && !matchError && totalSteps > 0 && currentStepIdx >= totalSteps - 1 && (
              <div className="w-full mt-4 p-4 rounded-xl bg-gradient-to-r from-indigo-950/60 to-purple-950/40 border border-indigo-500/30 text-center space-y-2">
                <h3 className="font-black text-base text-white">
                  {autoMatchData.winner === 1 ? 'BOT CỦA BẠN ĐÃ CHIẾN THẮNG' : 'BOSS ĐÃ CHIẾN THẮNG'}
                </h3>
                <p className="text-xs text-slate-300">
                  Kết quả: <strong className="text-amber-300">
                    {autoMatchData.winReason === 'FLAG_CAPTURE'
                      ? 'CƯỚP CỜ THÀNH CÔNG (Chiếm căn cứ đối phương)'
                      : autoMatchData.winReason === 'ELIMINATION'
                      ? 'Tiêu diệt toàn bộ quân địch'
                      : autoMatchData.winReason === 'MAX_TURNS_REACHED'
                      ? '⏱️ Hết 150 lượt (Bên nhiều quân hơn thắng)'
                      : autoMatchData.winReason === 'TIMEOUT'
                      ? '⌛ Bot đối phương quá giờ 1.0s'
                      : autoMatchData.winReason}
                  </strong> trong {autoMatchData.totalTurns} lượt cờ.
                </p>
                {onSelectReplay && (
                  <button
                    onClick={() => onSelectReplay(autoMatchData.replay)}
                    className="mt-2 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-colors"
                  >
                    Mở trình phân tích replay
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Combat Log Panel */}
          <div className="rounded-2xl bg-[#0e1322]/80 border border-white/5 p-5 backdrop-blur-md h-[480px] flex flex-col">
            <h3 className="font-bold text-sm text-white pb-3 border-b border-white/5 flex items-center gap-2">
              <span>Diễn Biến Từng Nước Đi Của Bot</span>
            </h3>

            <div className="flex-1 overflow-y-auto py-3 space-y-2 scrollbar-thin font-mono text-xs">
              {replaySteps.slice(0, currentStepIdx + 1).map((step, idx) => {
                const isP1 = step.player === 1;
                return (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border leading-relaxed ${
                      step.combat
                        ? step.combat.outcome === 'WIN'
                          ? 'bg-emerald-950/30 border-emerald-500/20 text-emerald-300'
                          : 'bg-red-950/30 border-red-500/20 text-red-300'
                        : 'bg-white/[0.02] border-white/5 text-slate-300'
                    }`}
                  >
                    <div className="text-[10px] text-slate-500 flex justify-between">
                      <span className={isP1 ? 'text-sky-400 font-bold' : 'text-rose-400 font-bold'}>
                        Lượt #{step.step} - {isP1 ? 'Phe Xanh (P1)' : 'Phe Đỏ (P2)'}
                      </span>
                      <span>{step.executionTimeMs || 0}ms</span>
                    </div>
                    <div className="mt-1 font-semibold">
                      Di chuyển ({step.move.fromRow}, {step.move.fromCol}) → ({step.move.toRow}, {step.move.toCol})
                    </div>
                    {step.botDecision && (
                      <div className="mt-1 text-[11px] text-slate-400 space-y-1">
                        <div className="text-indigo-300 font-semibold">{step.botDecision.algorithm}</div>
                        <div>{step.botDecision.reason}</div>
                        {step.botDecision.searchedNodes != null && (
                          <div>Độ sâu: {step.botDecision.searchDepth} lượt · Đã xét {step.botDecision.searchedNodes} trạng thái</div>
                        )}
                        {step.botDecision.pathCost != null && (
                          <div>Chi phí đường tới cờ: {step.botDecision.pathCost} (gồm rủi ro giao tranh)</div>
                        )}
                      </div>
                    )}
                    {step.combat && (
                      <div className="text-[11px] mt-1 text-amber-300">
                        Giao tranh: {step.combat.attacker?.type} vs {step.combat.defender?.type} → {step.combat.outcome}
                      </div>
                    )}
                    {step.warning && (
                      <div className="text-[10px] mt-1 text-amber-400 bg-amber-500/10 p-1 rounded border border-amber-500/20">
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
