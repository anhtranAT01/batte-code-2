import { matchLabel } from '../lib/matchLabel';
import React, { useState, useEffect, useRef } from 'react';
import GameBoard from './GameBoard';

export default function ReplayViewer({ initialReplay = null, onBack = null }) {
  const [replay, setReplay] = useState(null);
  const [matchIdInput, setMatchIdInput] = useState('');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 4x
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const timerRef = useRef(null);
  const requestRef = useRef(null);
  const [logPage,setLogPage] = useState(0);
  useEffect(()=>()=>{requestRef.current?.abort();requestRef.current=null;},[]);
  useEffect(()=>{setLogPage(Math.floor(currentStepIndex/50));},[currentStepIndex]);

  // If initialReplay changes, sync it
  useEffect(() => {
    if (initialReplay) {
      if (typeof initialReplay === 'string') {
        setMatchIdInput(initialReplay);
        loadReplayByMatchId(initialReplay);
      } else {
        requestRef.current?.abort();
        requestRef.current=null;
        setLoading(false);
        setError('');
        setLogPage(0);
        setReplay(initialReplay);
        setCurrentStepIndex(0);
        setIsPlaying(false);
      }
    }
  }, [initialReplay]);

  const loadReplayByMatchId = async (id) => {
    requestRef.current?.abort();
    const controller=new AbortController();
    requestRef.current=controller;
    const timeout=setTimeout(()=>controller.abort('timeout'),15000);
    setLoading(true);
    setError('');
    setLogPage(0);
    setReplay(null);
    setIsPlaying(false);
    try {
      const res = await fetch(`/api/game/replay/${encodeURIComponent(id.trim())}`,{signal:controller.signal});
      const data = await res.json();
      if(controller.signal.aborted || requestRef.current!==controller)return;
      if (res.ok && data.success) {
        setReplay(data.data);
        setCurrentStepIndex(0);
      } else {
        setError(data.message || 'Không tìm thấy dữ liệu Replay cho trận này.');
      }
    } catch {
      if(requestRef.current===controller && (!controller.signal.aborted || controller.signal.reason==='timeout'))
        setError(controller.signal.reason==='timeout'?'Tải replay quá lâu. Vui lòng thử lại.':'Lỗi khi tải bản ghi Replay.');
    } finally {
      clearTimeout(timeout);
      if(requestRef.current===controller)setLoading(false);
    }
  };

  const steps = replay?.steps || [];
  const totalSteps = steps.length;
  const currentStep = steps[currentStepIndex] || null;

  // Auto playback loop
  useEffect(() => {
    if (isPlaying && totalSteps > 0) {
      const intervalMs = Math.max(150, 1000 / playbackSpeed);
      timerRef.current = setInterval(() => {
        setCurrentStepIndex((prev) => {
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
  }, [isPlaying, playbackSpeed, totalSteps]);

  // Load replay by Match ID
  const fetchReplayById = async (e) => {
    e?.preventDefault();
    if (!matchIdInput.trim()) return;

    await loadReplayByMatchId(matchIdInput);
  };

  // Determine current grid state from step snapshot
  const currentGrid =
    currentStep?.boardSnapshot ||
    steps[currentStepIndex]?.boardSnapshot ||
    replay?.initialBoard ||
    steps[0]?.boardSnapshot ||
    [];
  const boardSize = Array.isArray(currentGrid) && currentGrid.length > 0 ? currentGrid.length : (replay?.size || 9);

  return (
    <div className="space-y-6">
      {/* Top Search & Overview */}
      <div className="glass-panel p-4 lg:p-6 rounded-2xl border border-white/10 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold border border-white/5 transition-colors flex items-center gap-1"
              >
                <span>←</span>
                <span>Quay lại</span>
              </button>
            )}
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Trình Xem Lại Trận Đấu (Replay Viewer)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {replay?.matchId ? (
                  <span>
                    Trận <strong className="text-cyan-400 font-mono">{matchLabel(replay)}</strong>: <strong className="text-blue-400">{replay.p1Name || 'Phe Xanh'}</strong> vs <strong className="text-red-400">{replay.p2Name || 'Phe Đỏ'}</strong> {replay.winnerName ? (
                      <span>
                        {' '}— <strong className="text-emerald-400">{replay.winnerName}</strong> Thắng ({replay.winReason === 'FLAG_CAPTURE' ? 'Cướp Cờ Thành Công' : replay.winReason === 'ELIMINATION' ? 'Quét Sạch Quân' : replay.winReason || ''})
                      </span>
                    ) : ''}
                  </span>
                ) : (
                  'Tua từng bước cờ, theo dõi biến động thế trận, bình phép và phát hiện lỗi vòng lặp vô hạn'
                )}
              </p>
            </div>
          </div>

          {/* Match ID search input */}
          <form onSubmit={fetchReplayById} className="flex items-center gap-2">
            <input
              type="text"
              value={matchIdInput}
              onChange={(e) => setMatchIdInput(e.target.value)}
              placeholder="Mã trận, ví dụ #001 hoặc 001"
              aria-label="Mã trận cần xem lại"
              className="px-3.5 py-2 rounded-xl bg-dark-900 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400 w-56 lg:w-72"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-black shadow-md shadow-cyan-500/20 disabled:opacity-50"
            >
              {loading ? 'Đang Tải...' : 'Tìm Trận'}
            </button>
          </form>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}
      </div>

      {totalSteps === 0 ? (
        <div className="glass-panel p-12 text-center rounded-2xl border border-white/10 text-slate-400 space-y-3">
          <span className="feature-code">REPLAY</span>
          <p className="text-sm font-medium">Chưa có dữ liệu Replay nào được chọn.</p>
          <p className="text-xs text-slate-500">
            Bạn có thể vừa chơi xong một trận ở tab "Luyện Tập" hoặc dán mã Match ID vào ô tìm kiếm ở trên.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Interactive Board & Controls */}
          <div className="lg:col-span-8 space-y-4">
            {/* Global Warning Banner for Infinite Loop / Timeout */}
            {(replay.winReason === 'INFINITE_LOOP' || replay.winReason === 'TIMEOUT' || currentStep?.hasInfiniteLoop) && (
              <div className="p-3.5 rounded-2xl bg-red-500/15 border-2 border-red-500/50 text-red-300 text-xs flex items-center gap-3 animate-pulse shadow-lg shadow-red-500/20">
                <div>
                  <h4 className="font-bold text-red-200">
                    CẢNH BÁO: PHÁT HIỆN LỖI VÒNG LẶP VÔ HẠN HOẶC QUÁ GIỜ (TIMEOUT)!
                  </h4>
                  <p className="text-red-300/90 text-[11px] mt-0.5">
                    {currentStep?.error || 'Bot AI đã bị ngắt tiến trình do vượt quá giới hạn 1.0 giây hoặc lặp lại bàn cờ 5 lần liên tiếp. Người chơi bị xử thua lập tức.'}
                  </p>
                </div>
              </div>
            )}

            {/* Board */}
            <GameBoard
              size={boardSize}
              grid={currentGrid}
              lastMove={currentStep?.move}
              readOnly={true}
              disabled={true}
            />

            {/* Playback Controls & Slider */}
            <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-3">
              {/* Turn Slider */}
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono text-cyan-400 font-bold whitespace-nowrap">
                  Bước {currentStepIndex + 1} / {totalSteps}
                </span>
                <input
                  type="range"
                  min="0"
                  max={totalSteps - 1}
                  value={currentStepIndex}
                  onChange={(e) => {
                    setCurrentStepIndex(Number(e.target.value));
                    setIsPlaying(false);
                  }}
                  className="w-full h-2 bg-dark-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setCurrentStepIndex(0);
                      setIsPlaying(false);
                    }}
                    className="p-2 rounded-lg bg-dark-900 hover:bg-dark-700 text-slate-300 hover:text-white text-xs border border-white/5"
                    title="Về đầu"
                  >
                    ⏮ Đầu
                  </button>
                  <button
                    onClick={() => {
                      setCurrentStepIndex((prev) => Math.max(0, prev - 1));
                      setIsPlaying(false);
                    }}
                    className="p-2 rounded-lg bg-dark-900 hover:bg-dark-700 text-slate-300 hover:text-white text-xs border border-white/5"
                    title="Lùi 1 bước"
                  >
                    ◀ Trước
                  </button>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="px-4 py-2 rounded-lg font-bold text-xs bg-cyan-500 hover:bg-cyan-400 text-black shadow-md shadow-cyan-500/20"
                  >
                    {isPlaying ? '⏸ Tạm Dừng' : '▶ Phát Replay'}
                  </button>
                  <button
                    onClick={() => {
                      setCurrentStepIndex((prev) => Math.min(totalSteps - 1, prev + 1));
                      setIsPlaying(false);
                    }}
                    className="p-2 rounded-lg bg-dark-900 hover:bg-dark-700 text-slate-300 hover:text-white text-xs border border-white/5"
                    title="Tiến 1 bước"
                  >
                    Tiếp ▶
                  </button>
                  <button
                    onClick={() => {
                      setCurrentStepIndex(totalSteps - 1);
                      setIsPlaying(false);
                    }}
                    className="p-2 rounded-lg bg-dark-900 hover:bg-dark-700 text-slate-300 hover:text-white text-xs border border-white/5"
                    title="Đến cuối"
                  >
                    Cuối ⏭
                  </button>
                </div>

                {/* Speed Selector */}
                <div className="flex items-center gap-1 bg-dark-900/80 p-1 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-400 px-2 font-semibold">Tốc độ:</span>
                  {[1, 2, 4].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackSpeed(speed)}
                      className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                        playbackSpeed === speed
                          ? 'bg-cyan-500 text-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Match Log (Nhật ký từng bước cờ) */}
          <div className="lg:col-span-4">
            <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col h-[600px]">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                  Nhật Ký Trận Đấu (Match Log)
                </h3>
                <span className="text-[11px] font-mono text-cyan-400 font-bold">
                  {totalSteps} bước
                </span>
              </div>

              {/* Scrollable Step List */}
              <div className="flex items-center justify-between gap-2 text-xs text-slate-400 mb-3">
                <button type="button" disabled={logPage===0} onClick={()=>setLogPage(page=>page-1)}>← Nhật ký trước</button>
                <span>{logPage*50+1}–{Math.min(totalSteps,(logPage+1)*50)}</span>
                <button type="button" disabled={(logPage+1)*50>=totalSteps} onClick={()=>setLogPage(page=>page+1)}>Nhật ký sau →</button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {steps.slice(logPage*50,(logPage+1)*50).map((st, localIndex) => {
                  const idx=logPage*50+localIndex;
                  const isCurrent = idx === currentStepIndex;
                  const isP1 = st.player === 1;

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setCurrentStepIndex(idx);
                        setIsPlaying(false);
                      }}
                      className={`p-2.5 rounded-xl text-xs cursor-pointer transition-all border ${
                        isCurrent
                          ? 'bg-cyan-500/15 border-cyan-400/50 shadow-md shadow-cyan-500/10'
                          : 'bg-dark-800/60 hover:bg-dark-700/80 border-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`font-bold font-mono text-[10px] px-1.5 py-0.5 rounded ${
                            isP1 ? 'bg-sky-500/20 text-sky-300' : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          Bước #{st.step || idx + 1} | P{st.player}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {st.executionTimeMs || st.durationMs || 0}ms
                        </span>
                      </div>

                      {/* Move Details */}
                      {st.move && (
                        <p className="text-slate-300 font-mono text-[11px]">
                          Đi ({st.move.fromRow}, {st.move.fromCol}) → ({st.move.toRow}, {st.move.toCol})
                        </p>
                      )}

                      {/* Combat Details */}
                      {st.combat && (
                        <p className="text-amber-300 font-semibold mt-1">
                          Chiến đấu: {st.combat.outcome}
                          {st.combat.converted && ' (Đã đồng hóa quân đối phương)'}
                        </p>
                      )}

                      {/* Potion Pickup */}
                      {st.itemCollected && (
                        <p className="text-emerald-400 font-medium mt-0.5">
                          Nhặt vật phẩm: {st.itemCollected.type}
                        </p>
                      )}

                      {/* Clone spawned */}
                      {st.cloneSpawned && (
                        <p className="text-purple-400 font-medium mt-0.5">
                          Tạo thêm 1 phân thân tại ({st.cloneSpawned.row}, {st.cloneSpawned.col})
                        </p>
                      )}

                      {/* Error Highlight */}
                      {st.error && (
                        <div className="mt-1 p-1.5 rounded bg-red-500/20 border border-red-500/30 text-red-300 text-[10px]">
                          {st.error}
                        </div>
                      )}

                      {/* Warning / Fallback Notice */}
                      {st.warning && (
                        <div className="mt-1 p-1.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px]">
                          {st.warning}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
