import React, { useState, useEffect } from 'react';
import GameBoard from './GameBoard';
import { useAuth } from '../context/AuthContext';

export default function PracticeArena({ onSelectReplay }) {
  const { user, getAuthHeaders } = useAuth();

  // Match configuration states
  const [boardSize, setBoardSize] = useState(8);
  const [difficulty, setDifficulty] = useState('medium');
  const [botLevel, setBotLevel] = useState('MEDIUM');
  const [mode, setMode] = useState('VS_AI'); // 'VS_AI' | 'RANKED_MATCHMAKING'

  // Match Runtime states
  const [matchId, setMatchId] = useState(null);
  const [grid, setGrid] = useState([]);
  const [validMoves, setValidMoves] = useState([]);
  const [selectedPiece, setSelectedPiece] = useState(null);
  const [currentTurn, setCurrentTurn] = useState(1);
  const [turnCount, setTurnCount] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [winReason, setWinReason] = useState(null);
  const [lastReplay, setLastReplay] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [matchmakingInfo, setMatchmakingInfo] = useState(null);

  // Initialize a practice match on mount
  useEffect(() => {
    startNewMatch();
  }, []);

  const startNewMatch = async () => {
    setLoading(true);
    setStatusMessage('Đang khởi tạo trận đấu...');
    setSelectedPiece(null);
    setIsGameOver(false);
    setWinner(null);
    setWinReason(null);
    setLastReplay(null);

    try {
      if (mode === 'VS_AI') {
        const res = await fetch('/api/game/practice/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            boardSize,
            difficulty,
            botLevel,
          }),
        });

        const data = await res.json();
        if (data.success) {
          const matchData = data.data;
          setMatchId(matchData.matchId);
          setGrid(matchData.board);
          setValidMoves(matchData.validMoves || []);
          setCurrentTurn(matchData.currentTurnPlayer);
          setTurnCount(matchData.turnCount);
          setStatusMessage('Trận đấu đã sẵn sàng! Bạn cầm quân Xanh (P1), hãy chọn quân để đi.');
        } else {
          setStatusMessage(data.message || 'Lỗi khởi tạo bàn cờ.');
        }
      } else {
        // Ranked Matchmaking
        const res = await fetch('/api/tournaments/matchmaking/join', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (data.success) {
          setMatchmakingInfo(data.data);
          setStatusMessage(data.data.message || 'Đang tìm đối thủ cùng trình độ Elo...');
        }
      }
    } catch (err) {
      setStatusMessage('Không thể kết nối đến máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  // Handle clicking on a board cell
  const handleTileClick = async (r, c) => {
    if (isGameOver || loading || currentTurn !== 1) return;

    const cell = grid[r]?.[c];
    const piece = cell?.piece;

    // 1. Select player's own piece
    if (piece && piece.player === 1) {
      setSelectedPiece(piece);
      return;
    }

    // 2. If a piece was selected, check if clicked tile is a legal move target
    if (selectedPiece) {
      const isLegal = validMoves.some(
        (m) =>
          m.fromRow === selectedPiece.row &&
          m.fromCol === selectedPiece.col &&
          m.toRow === r &&
          m.toCol === c
      );

      if (isLegal) {
        const move = {
          fromRow: selectedPiece.row,
          fromCol: selectedPiece.col,
          toRow: r,
          toCol: c,
        };

        await submitMove(move);
        setSelectedPiece(null);
      }
    }
  };

  const submitMove = async (move) => {
    setLoading(true);
    setStatusMessage('Đang xử lý nước đi của bạn & Bot AI đang phản đòn...');

    try {
      const res = await fetch('/api/game/practice/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          matchId,
          move,
          executionTimeMs: 150,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const result = data.data;
        setGrid(result.board);
        setValidMoves(result.validMoves || []);

        if (result.isGameOver) {
          setIsGameOver(true);
          setWinner(result.winner);
          setWinReason(result.winReason);
          setLastReplay(result.replay);
          setStatusMessage(
            result.winner === 1
              ? 'Bạn đã giành CHIẾN THẮNG!'
              : result.winner === 2
              ? 'Bot máy đã giành chiến thắng.'
              : 'Trận đấu kết thúc với kết quả HÒA.'
          );
        } else {
          setStatusMessage('Lượt tiếp theo của bạn (Người chơi 1).');
        }
      } else {
        setStatusMessage(data.message || 'Nước đi không hợp lệ.');
      }
    } catch {
      setStatusMessage('Lỗi giao tiếp máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Configuration Bar */}
      <div className="glass-panel p-4 lg:p-6 rounded-2xl border border-white/10 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-white/5">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Đấu Trường Luyện Tập Chiến Thuật
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Tùy biến bản đồ 8x8 hoặc 9x9, rèn luyện kỹ năng với Bot AI hoặc ghép trận xếp hạng Elo
            </p>
          </div>

          <button
            onClick={startNewMatch}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black shadow-lg shadow-emerald-500/20 transition-all transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            {loading ? 'Đang Khởi Tạo...' : 'Tạo Trận Đấu Mới'}
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Kích Thước Bàn Cờ
            </label>
            <select
              value={boardSize}
              onChange={(e) => setBoardSize(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-dark-900 border border-white/10 text-white text-xs font-medium focus:outline-none focus:border-cyan-400"
            >
              <option value={8}>Bàn Cờ 8 x 8 (Tiêu chuẩn 16 quân)</option>
              <option value={9}>Bàn Cờ 9 x 9 (Đại đấu trường 18 quân)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Địa Hình & Vật Cản
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-dark-900 border border-white/10 text-white text-xs font-medium focus:outline-none focus:border-cyan-400"
            >
              <option value="easy">Mức Dễ (4 vật cản, nhiều bình thưởng)</option>
              <option value="medium">Mức Trung Bình (6 vật cản, cân bằng)</option>
              <option value="hard">Mức Khó (Mê cung hẹp, chiến thuật cao)</option>
              <option value="random">Ngẫu Nhiên (Random map đối xứng tâm)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Độ Khó Bot AI
            </label>
            <select
              value={botLevel}
              onChange={(e) => setBotLevel(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-dark-900 border border-white/10 text-white text-xs font-medium focus:outline-none focus:border-cyan-400"
            >
              <option value="EASY">Tân Thủ Heuristic (Ăn quân, nhặt vật phẩm)</option>
              <option value="MEDIUM">Sát Thủ Tốc Độ (Ưu tiên bình Tăng Tốc)</option>
              <option value="HARD">Bậc Thầy Alpha-Beta (Minimax 3 lượt)</option>
              <option value="GRANDMASTER">Đại Sư A* (Tìm đường cướp cờ)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Chế Độ Chơi
            </label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-dark-900 border border-white/10 text-white text-xs font-medium focus:outline-none focus:border-cyan-400"
            >
              <option value="VS_AI">Đấu Luyện Tập Với AI</option>
              <option value="RANKED_MATCHMAKING">Ghép Cặp Xếp Hạng Elo</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Arena View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: The Board */}
        <div className="lg:col-span-8 flex flex-col items-center">
          {/* Status Message */}
          <div className="w-full mb-3 px-4 py-2.5 rounded-xl glass-card flex items-center justify-between text-xs">
            <span className="font-medium text-slate-300">{statusMessage}</span>
            <span className="font-mono text-cyan-400 font-bold">
              {currentTurn === 1 ? 'LƯỢT: P1 (BẠN)' : 'LƯỢT: P2 (BOT)'}
            </span>
          </div>

          <GameBoard
            grid={grid}
            selectedPiece={selectedPiece}
            validMoves={validMoves}
            onTileClick={handleTileClick}
          />
        </div>

        {/* Right: Telemetry & Controls */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
            <h3 className="text-base font-bold text-white border-b border-white/10 pb-2">
              Thông Tin Trận Đấu
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 px-2.5 rounded-lg bg-dark-900/60 border border-white/5">
                <span className="text-slate-400">Mã trận đấu:</span>
                <span className="font-mono font-bold text-slate-200">{matchId || '---'}</span>
              </div>
              <div className="flex justify-between py-1.5 px-2.5 rounded-lg bg-dark-900/60 border border-white/5">
                <span className="text-slate-400">Kích thước & Địa hình:</span>
                <span className="font-semibold text-cyan-400">
                  {boardSize}x{boardSize} ({difficulty.toUpperCase()})
                </span>
              </div>
              <div className="flex justify-between py-1.5 px-2.5 rounded-lg bg-dark-900/60 border border-white/5">
                <span className="text-slate-400">Đối thủ:</span>
                <span className="font-semibold text-rose-400">
                  Bot AI ({botLevel})
                </span>
              </div>
              <div className="flex justify-between py-1.5 px-2.5 rounded-lg bg-dark-900/60 border border-white/5">
                <span className="text-slate-400">Số nước đi hợp lệ:</span>
                <span className="font-mono font-bold text-emerald-400">{validMoves.length}</span>
              </div>
            </div>

            {/* Replay Quick Action */}
            {lastReplay && (
              <div className="pt-2">
                <button
                  onClick={() => onSelectReplay(lastReplay)}
                  className="w-full py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-1.5"
                >
                  Mở Xem Lại Trận Này (Replay)
                </button>
              </div>
            )}
          </div>

          {/* Tactical Tips Card */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-2 text-xs text-slate-300">
            <h4 className="font-bold text-amber-400 flex items-center gap-1.5">
              Mẹo Chiến Thuật Cao Cấp:
            </h4>
            <ul className="list-disc list-inside space-y-1.5 text-slate-400">
              <li>
                <strong className="text-slate-200">Bình Đồng Hóa:</strong> Giúp bạn biến quân đối phương thành quân mình thay vì tiêu diệt. Rất giá trị khi lật ngược thế cờ!
              </li>
              <li>
                <strong className="text-slate-200">Bình Sinh Sản:</strong> Tự động sinh thêm 1 quân cờ cùng loại ở ô kề bên, nhân đôi quân số.
              </li>
              <li>
                <strong className="text-slate-200">Bình Đi 2 Bước:</strong> Đột kích bất ngờ hoặc rút chạy an toàn khi bị dồn ép.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
