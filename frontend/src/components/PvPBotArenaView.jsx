import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import GameBoard from './GameBoard';
import { runDuel, applyDuelEvent } from '../lib/duelStream';
import { invalidatePublicData } from '../lib/publicData';
import Icon from './Icons';
import {readScreenData,peekScreenData} from '../lib/screenData';

export default function PvPBotArenaView({ onSelectReplay, preselectedOpponent = null, onOpenBots }) {
  const { user, getAuthHeaders } = useAuth();

  const [players, setPlayers] = useState(()=>peekScreenData('/api/bots/players') || []);
  const [selectedOpponentId, setSelectedOpponentId] = useState(()=>preselectedOpponent?.id || peekScreenData('/api/bots/players')?.find(player=>player.id!==user?.id)?.id || '');
  const [boardSize, setBoardSize] = useState(9);
  const [loading, setLoading] = useState(false);
  const [botsLoading, setBotsLoading] = useState(()=>!peekScreenData('/api/bots/players'));
  const [selectionError, setSelectionError] = useState('');
  const [autoMatchData, setAutoMatchData] = useState(null);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const timerRef = useRef(null);
  const requestRef = useRef(null);
  const playersRequest=useRef(0);
  const playbackRef = useRef({ totalSteps: 0, loading: false });
  const [queuePosition, setQueuePosition] = useState(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  const leaveMatch = () => {
    requestRef.current?.abort();
    setAutoMatchData(null);
    setIsFullScreen(false);
  };

  const receiveProgress = (event) => {
    if (event.type === 'queued') setQueuePosition(event.data.position);
    else setAutoMatchData((current) => applyDuelEvent(current, event));
  };

  const loadPlayers = async (isCancelled = () => false,force=true) => {
    const request=++playersRequest.current;
    const stale=()=>isCancelled() || request!==playersRequest.current;
    setBotsLoading(force || !peekScreenData('/api/bots/players'));
    setSelectionError('');
    try {
      const list=await readScreenData('/api/bots/players',{force});
      if (stale()) return;
      setPlayers(list);
      setSelectedOpponentId((current) =>
        list.some((player) => player.id === current && player.id !== user?.id)
          ? current
          : list.find((player) => player.id !== user?.id)?.id || ''
      );
    } catch (error) {
      if (!stale()) setSelectionError(error.message);
    } finally {
      if (!stale()) setBotsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    loadPlayers(() => cancelled,false);
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (preselectedOpponent?.id && preselectedOpponent.id !== user?.id) {
      setSelectedOpponentId(preselectedOpponent.id);
    }
  }, [preselectedOpponent?.id, user?.id]);

  const replaySteps = autoMatchData?.replay?.steps || [];
  const totalSteps = replaySteps.length;
  playbackRef.current = { totalSteps, loading };

  const opponents = players.filter((player) => player.id !== user?.id);
  const selectedOpponent = opponents.find((player) => player.id === selectedOpponentId);
  const ownProfile = players.find((player) => player.id === user?.id);
  const canStart = Boolean(user && ownProfile?.ready && selectedOpponent?.ready);

  // Autoplay step timer
  useEffect(() => {
    if (autoMatchData && isPlaying) {
      const intervalMs = Math.max(120, 700 / playSpeed);
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

  const handlePickRandomOpponent = () => {
    const others = opponents.filter((player) => player.id !== selectedOpponentId);
    if (others.length) setSelectedOpponentId(others[Math.floor(Math.random() * others.length)].id);
  };

  const handleStartPvPDuel = async () => {
    if (!canStart) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setQueuePosition(null);
    setLoading(true);
    setSelectionError('');
    setAutoMatchData(null);
    setCurrentStepIdx(0);
    setIsPlaying(true);
    try {
      const result = await runDuel('/api/game/pvp', {
        body: { opponentUserId: selectedOpponentId, boardSize },
        headers: getAuthHeaders(),
        signal: controller.signal,
        onUpdate: receiveProgress,
      });
      if (controller.signal.aborted) return;
      setAutoMatchData(result);
      invalidatePublicData();
    } catch (error) {
      if (!controller.signal.aborted) setSelectionError(error.message);
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
    <div className={`view-shell animate-fadeIn ${isFullScreen ? 'fixed inset-0 z-50 bg-navy-950 p-6 overflow-y-auto' : ''}`}>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-white tracking-wide flex items-center gap-2">
              <span>Đấu Bot PvP Trực Tiếp</span>
            </h1>
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white uppercase tracking-wider shadow-glow-cyan animate-pulse">
              100% ĐẤU THỦ THẬT
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Chế độ so tài độc lập giữa 2 sinh viên. Chọn đối thủ, hệ thống tự động chạy bot Python chính thức của 2 bên theo luật Kéo - Búa - Bao & Cướp Cờ 9×9!
          </p>
        </div>

        {autoMatchData && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="icon-button"
              title={isFullScreen ? 'Thu nhỏ giao diện' : 'Xem toàn màn hình'}
            >
              <Icon name={isFullScreen ? 'minimize' : 'maximize'} size={16} />
            </button>
            <button
              type="button"
              onClick={leaveMatch}
              className="secondary-action text-xs"
            >
              ← Chọn Cặp Đấu Khác
            </button>
          </div>
        )}
      </div>

      {selectionError && (
        <div role="alert" className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-sm text-red-300 flex items-center gap-2">
          <Icon name="alert" size={16} className="text-red-400 flex-shrink-0" />
          <span>{selectionError}</span>
        </div>
      )}

      {loading && (
        <div role="status" className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-500/20 text-sm text-blue-300 flex items-center gap-2.5 mb-2">
          <Icon name="refresh" className="animate-spin text-cyan-400" size={16} />
          <span>
            {queuePosition && !autoMatchData
              ? `Đang xếp hàng máy chấm: Vị trí ${queuePosition}. Máy chủ sẽ mở bàn cờ ngay khi đến lượt.`
              : autoMatchData
              ? `Bot đang tính toán tiếp · Đã hoàn thành ${totalSteps} lượt cờ.`
              : 'Đang kết nối worker thread và khởi tạo bàn đấu...'}
          </span>
          {!autoMatchData && (
            <button type="button" onClick={leaveMatch} className="ml-auto text-xs text-cyan-300 underline font-bold">
              Hủy chờ
            </button>
          )}
        </div>
      )}

      {!autoMatchData ? (
        /* Match Setup Screen */
        <div className="space-y-6">
          {/* Opponent Selector Card */}
          <div className="cyber-card p-5 space-y-3 border-blue-500/30">
            <label htmlFor="pvp-opponent" className="block text-xs font-black uppercase tracking-wider text-blue-400">
              Chọn Đối Thủ Thi Đấu (Phe Đỏ)
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <select
                id="pvp-opponent"
                aria-label="Người chơi đối thủ"
                value={selectedOpponentId}
                title={selectedOpponent?.username || 'Chọn đối thủ'}
                onChange={(event) => setSelectedOpponentId(event.target.value)}
                className="min-w-0 flex-1 py-2.5 px-3.5 rounded-xl bg-navy-950 border border-white/10 text-white text-xs font-semibold focus:border-blue-500"
              >
                <option value="" disabled>
                  {botsLoading ? 'Đang tải danh sách người chơi...' : 'Chọn người chơi đối thủ'}
                </option>
                {opponents.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.username} ({player.elo_rating} Elo)
                    {player.ready ? '' : ' — Chưa sẵn sàng'}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handlePickRandomOpponent}
                disabled={opponents.length < 2 || botsLoading}
                title={opponents.length > 1 ? 'Chọn ngẫu nhiên một đối thủ khác' : 'Chưa có đủ người chơi để đổi'}
                className="secondary-action text-xs"
              >
                <Icon name="refresh" size={14} />
                <span>Đổi ngẫu nhiên</span>
              </button>

              <button
                type="button"
                onClick={() => loadPlayers()}
                disabled={botsLoading}
                className="secondary-action text-xs"
              >
                <span>Làm mới danh sách và bot chính</span>
              </button>
            </div>

            {selectedOpponent && (
              <p className="selection-summary text-xs text-slate-300">
                Đối thủ đã chọn: <strong>{selectedOpponent.username}</strong> · {selectedOpponent.elo_rating} Elo
              </p>
            )}
            <p className="text-[11px] text-slate-400">
              Người bạn chọn sẽ điều khiển quân cờ phe Đỏ với mã nguồn bot chính thức mà họ đã kích hoạt trên tài khoản.
            </p>
          </div>

          {/* Commander Duelists Matchup HUD Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 items-center">
            {/* Player 1 Card (Blue Team) */}
            <div className="lg:col-span-5 p-6 rounded-2xl bg-gradient-to-br from-blue-950/40 via-navy-900 to-navy-950 border border-blue-500/40 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-glow-blue animate-pulse" />
                  PHE XANH (CĂN CỨ 0,0)
                </span>
                <span className="text-xs font-mono font-black text-amber-400">
                  {user?.elo_rating || 1200} Elo
                </span>
              </div>

              <div className="flex items-center gap-3.5 pt-1">
                <div className="duelist-avatar w-12 h-12 text-xl font-black rounded-xl">
                  {user?.username ? user.username.charAt(0).toUpperCase() : 'B'}
                </div>
                <div>
                  <div className="font-extrabold text-white text-base">
                    {user?.username || 'Bạn (Đấu thủ 1)'}
                  </div>
                  <div className="text-[11px] text-blue-300 font-semibold mt-0.5">
                    Người khởi xướng thách đấu
                  </div>
                </div>
              </div>

              <div className="pt-2 space-y-1.5 border-t border-white/5">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Bot Chính Khởi Tranh</p>
                <p className="text-sm font-bold text-white">{ownProfile?.bot?.name || 'Chưa kích hoạt bot chính'}</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {ownProfile?.ready
                    ? 'Chạy nguyên vẹn mã nguồn Python bạn đã nộp trong Kho Bot.'
                    : ownProfile?.reason || 'Vào Kho Bot để kích hoạt bot thi đấu của bạn.'}
                </p>
                <button
                  type="button"
                  onClick={onOpenBots}
                  className="text-xs text-cyan-400 hover:text-cyan-300 underline font-bold inline-flex items-center gap-1 pt-1"
                >
                  <span>Mở Kho Bot kích hoạt bot chính</span>
                  <Icon name="chevronRight" size={13} />
                </button>
              </div>
            </div>

            {/* VS Badge */}
            <div className="lg:col-span-1 flex flex-col items-center justify-center py-2">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 via-red-500 to-purple-600 flex items-center justify-center text-black font-black text-sm shadow-xl shadow-red-500/30 ring-4 ring-navy-950">
                VS
              </div>
            </div>

            {/* Player 2 Card (Red Team) */}
            <div className="lg:col-span-5 p-6 rounded-2xl bg-gradient-to-br from-red-950/40 via-navy-900 to-navy-950 border border-red-500/40 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-glow-red animate-pulse" />
                  PHE ĐỎ (CĂN CỨ {boardSize - 1},{boardSize - 1})
                </span>
                <span className="text-xs font-mono font-black text-amber-400">
                  {selectedOpponent?.elo_rating ?? '—'} Elo
                </span>
              </div>

              <div className="flex items-center gap-3.5 pt-1">
                <div className="duelist-avatar is-red w-12 h-12 text-xl font-black rounded-xl">
                  {selectedOpponent?.username ? selectedOpponent.username.charAt(0).toUpperCase() : 'O'}
                </div>
                <div>
                  <div className="font-extrabold text-white text-base">
                    {selectedOpponent?.username || 'Đấu thủ đối diện'}
                  </div>
                  <div className="text-[11px] text-red-300 font-semibold mt-0.5">
                    Đối thủ được chọn so tài
                  </div>
                </div>
              </div>

              <div className="pt-2 space-y-1.5 border-t border-white/5">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Bot Chính Đối Phương</p>
                <p className="text-sm font-bold text-white">
                  <strong>{selectedOpponent?.bot?.name || 'Chưa chọn'}</strong>
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {selectedOpponent?.ready
                    ? 'Bot do chính đấu thủ này kích hoạt trên tài khoản của họ.'
                    : selectedOpponent?.reason || 'Chọn người chơi để kiểm tra bot chính.'}
                </p>
              </div>
            </div>
          </div>

          {/* Match Settings & Launch Button */}
          <div className="cyber-card p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                Kích Thước Bàn Cờ Thi Đấu
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[8, 9].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setBoardSize(size)}
                    className={`py-2.5 px-3 rounded-xl border font-bold text-xs transition-all ${
                      boardSize === size
                        ? 'bg-blue-600 text-white border-blue-400 shadow-glow-blue'
                        : 'bg-navy-950 text-slate-400 border-white/10 hover:bg-white/5'
                    }`}
                  >
                    Bàn {size}×{size} {size === 9 ? '(Chuẩn Thi Đấu)' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs text-slate-400 space-y-1.5">
              <div className="flex items-center gap-2 text-slate-200 font-semibold">
                <span className="text-cyan-400 font-bold">🚩 Cướp Cờ:</span> Bên nào chạm cứ điểm đối phương thắng ngay.
              </div>
              <div className="flex items-center gap-2 text-slate-200 font-semibold">
                <span className="text-purple-400 font-bold">⚔️ Tương Khắc:</span> Kéo ăn Bao, Búa ăn Kéo, Bao ăn Búa.
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={handleStartPvPDuel}
                disabled={loading || botsLoading || !canStart}
                className="primary-action w-full py-4 text-sm font-black shadow-glow-blue uppercase tracking-wider"
              >
                <span>{loading ? 'Đang Khởi Chạy 2 Bot Python...' : 'KHỞI TRANH ĐẤU BOT 2 NGƯỜI (PvP)'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Live Match Arena Player with Central Board and Side Logs */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Central Battle Arena & Controls (8 Cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Arena Top HUD Bar */}
            <div className="cyber-card p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-blue-500 shadow-glow-blue animate-pulse" />
                <div>
                  <strong className="text-xs sm:text-sm text-blue-300 block font-black">
                    {autoMatchData.p1Name}
                  </strong>
                  <span className="text-[10px] text-slate-400 font-mono block">
                    {autoMatchData.p1BotName || 'Bot Phe Xanh'}
                  </span>
                </div>
              </div>

              <div className="text-center px-4 py-1.5 rounded-xl bg-navy-950 border border-white/10">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  Lượt Đấu
                </span>
                <strong className="text-base font-black font-mono text-cyan-400">
                  {currentStepIdx} / {totalSteps}
                </strong>
              </div>

              <div className="flex items-center gap-2.5 text-right">
                <div>
                  <strong className="text-xs sm:text-sm text-red-300 block font-black">
                    {autoMatchData.p2Name}
                  </strong>
                  <span className="text-[10px] text-slate-400 font-mono block">
                    {autoMatchData.p2BotName || 'Bot Phe Đỏ'}
                  </span>
                </div>
                <span className="w-3 h-3 rounded-full bg-red-500 shadow-glow-red animate-pulse" />
              </div>
            </div>

            {/* Central Game Board */}
            <GameBoard
              size={boardSize}
              grid={currentGrid}
              lastMove={currentStep?.move}
              disabled={true}
            />

            {/* Turn Seekbar and Playback Controller */}
            <div className="cyber-card p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-slate-400">0</span>
                <input
                  type="range"
                  min="0"
                  max={Math.max(0, totalSteps - 1)}
                  value={currentStepIdx}
                  onChange={(e) => {
                    setCurrentStepIdx(parseInt(e.target.value, 10));
                    setIsPlaying(false);
                  }}
                  className="flex-1 accent-cyan-400 h-2 rounded-lg cursor-pointer bg-navy-950 border border-white/10"
                />
                <span className="text-xs font-mono font-bold text-slate-400">{totalSteps}</span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentStepIdx(0);
                      setIsPlaying(false);
                    }}
                    className="icon-button text-xs"
                    title="Trở về bước đầu tiên"
                  >
                    <Icon name="rotateCcw" size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (currentStepIdx > 0) setCurrentStepIdx((prev) => prev - 1);
                      setIsPlaying(false);
                    }}
                    disabled={currentStepIdx === 0}
                    className="icon-button text-xs disabled:opacity-40"
                    title="Lùi 1 lượt"
                  >
                    <Icon name="stepBack" size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="primary-action px-4 text-xs font-black shadow-glow-blue"
                  >
                    <Icon name={isPlaying ? 'pause' : 'play'} size={15} />
                    <span>{isPlaying ? 'Tạm Dừng' : 'Tự Động Chạy'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (currentStepIdx < totalSteps - 1) setCurrentStepIdx((prev) => prev + 1);
                      setIsPlaying(false);
                    }}
                    disabled={currentStepIdx >= totalSteps - 1}
                    className="icon-button text-xs disabled:opacity-40"
                    title="Tiến 1 lượt"
                  >
                    <Icon name="stepForward" size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentStepIdx(Math.max(0, totalSteps - 1));
                      setIsPlaying(false);
                    }}
                    className="secondary-action text-xs"
                  >
                    <span>Tua Tới Kết Thúc</span>
                  </button>
                </div>

                {/* Speed selector pills */}
                <div className="flex items-center gap-1.5 bg-navy-950 p-1 rounded-xl border border-white/10">
                  <span className="text-[10px] font-bold text-slate-400 px-2 uppercase">Tốc độ</span>
                  {[0.5, 1, 2, 4].map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      onClick={() => setPlaySpeed(speed)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                        playSpeed === speed
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Victory Announcement Box */}
            {!loading && !selectionError && totalSteps > 0 && currentStepIdx >= totalSteps - 1 && (
              <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-950 via-navy-900 to-purple-950 border border-cyan-400/40 text-center space-y-3 shadow-2xl animate-fadeIn">
                <span className="text-3xl">🏆</span>
                <h3 className="font-black text-xl text-white tracking-tight">
                  CHIẾN THẮNG: {autoMatchData.winnerName}!
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
                  Lý do thắng: <strong className="text-amber-300">
                    {autoMatchData.winReason === 'FLAG_CAPTURE'
                      ? 'CƯỚP CỜ THÀNH CÔNG (Chiếm lĩnh căn cứ cứ điểm đối phương)'
                      : autoMatchData.winReason === 'ELIMINATION'
                      ? 'TIÊU DIỆT TOÀN BỘ QUÂN ĐỊCH'
                      : autoMatchData.winReason === 'MAX_TURNS_REACHED'
                      ? 'HẾT 150 LƯỢT (Bên nhiều quân hơn thắng theo luật)'
                      : autoMatchData.winReason}
                  </strong>{' '}
                  trong tổng số <strong>{autoMatchData.totalTurns}</strong> lượt cờ.
                </p>

                {onSelectReplay && (
                  <button
                    type="button"
                    onClick={() => onSelectReplay(autoMatchData.replay)}
                    className="primary-action px-6 py-2.5 text-xs font-black shadow-glow-cyan"
                  >
                    <span>Mở Trình Phân Tích Replay Chi Tiết</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right Move Logs (4 Cols) */}
          <div className="lg:col-span-4 cyber-card p-5 h-[620px] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <div className="flex items-center gap-2">
                <Icon name="zap" size={16} className="text-cyan-400" />
                <h4 className="font-extrabold text-sm text-white">Nhật Ký Từng Bước Của Bot</h4>
              </div>
              <span className="text-xs font-mono text-cyan-400 font-bold">{replaySteps.length} Nước</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin font-mono text-xs">
              {replaySteps.slice(0, currentStepIdx + 1).map((step, idx) => {
                const isP1 = step.player === 1;
                return (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl border leading-relaxed transition-all ${
                      step.combat
                        ? 'bg-purple-950/40 border-purple-500/30 text-purple-200'
                        : isP1
                        ? 'bg-blue-950/30 border-blue-500/30 text-blue-100'
                        : 'bg-red-950/30 border-red-500/30 text-red-100'
                    }`}
                  >
                    <div className="text-[10px] text-slate-400 flex justify-between font-bold">
                      <span className={isP1 ? 'text-blue-400' : 'text-red-400'}>
                        Lượt #{step.step} · {isP1 ? `Xanh (${autoMatchData.p1Name})` : `Đỏ (${autoMatchData.p2Name})`}
                      </span>
                      <span>{step.executionTimeMs || 0}ms</span>
                    </div>

                    <div className="mt-1 font-bold text-white">
                      Đi ({step.move.fromRow}, {step.move.fromCol}) → ({step.move.toRow}, {step.move.toCol})
                    </div>

                    {step.combat && (
                      <div className="text-[11px] mt-1 text-amber-300 font-sans">
                        ⚔️ Giao tranh: {step.combat.attacker?.type} vs {step.combat.defender?.type} → {step.combat.outcome}
                      </div>
                    )}

                    {step.itemCollected && (
                      <div className="text-[11px] mt-0.5 text-emerald-300 font-sans">
                        🧪 Nhặt vật phẩm: {step.itemCollected.type}
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
