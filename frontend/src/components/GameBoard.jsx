import React from 'react';

const PIECE_ICONS = {
  ROCK: '🪨',
  PAPER: '📄',
  SCISSORS: '✂️',
  R: '🪨',
  P: '📄',
  S: '✂️',
};

const ITEM_ICONS = {
  OBSTACLE: '🧱',
  POTION_INFECTION: '🧪',
  POTION_SPEED: '⚡',
  POTION_CLONE: '➕',
};

export default function GameBoard({
  grid: propGrid,
  board,
  selectedPiece = null,
  validMoves = [],
  onTileClick = () => {},
  readOnly = false,
  isInteractive = true,
}) {
  let grid = propGrid || board || [];
  if (typeof grid === 'string') {
    try {
      grid = JSON.parse(grid);
    } catch {
      grid = [];
    }
  }

  const rows = Array.isArray(grid) ? grid.length : 0;
  const cols = rows > 0 && Array.isArray(grid[0]) ? grid[0].length : 0;
  const isReadOnly = readOnly || isInteractive === false;

  if (rows === 0 || cols === 0) {
    return (
      <div className="flex items-center justify-center h-80 bg-dark-900/50 rounded-2xl border border-white/5 text-slate-500 text-sm">
        Đang khởi tạo bản đồ...
      </div>
    );
  }

  // Check if a cell is a valid move target for the selected piece
  const isMoveTarget = (r, c) => {
    if (!selectedPiece || !Array.isArray(validMoves)) return false;
    return validMoves.some(
      (m) => m.fromRow === selectedPiece.row && m.fromCol === selectedPiece.col && m.toRow === r && m.toCol === c
    );
  };

  return (
    <div className="flex flex-col items-center justify-center p-3 lg:p-6 bg-dark-900/80 rounded-2xl border border-white/10 shadow-2xl">
      <div
        className="grid gap-1.5 p-2 bg-dark-800/90 rounded-xl border border-white/5"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        }}
      >
        {grid.map((rowArr, r) =>
          rowArr.map((cell, c) => {
            const piece = cell?.piece || null;
            const item = cell?.item || null;
            const isSelected = selectedPiece && selectedPiece.row === r && selectedPiece.col === c;
            const isTarget = isMoveTarget(r, c);
            const isP1Flag = r === 0 && c === 0;
            const isP2Flag = r === rows - 1 && c === cols - 1;

            return (
              <div
                key={`${r}-${c}`}
                onClick={() => {
                  if (!isReadOnly) onTileClick(r, c);
                }}
                className={`relative w-11 h-11 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl flex items-center justify-center transition-all select-none ${
                  isReadOnly ? 'cursor-default' : 'cursor-pointer hover:scale-[1.04]'
                } ${
                  isSelected
                    ? 'ring-2 ring-amber-400 bg-amber-400/20 shadow-lg shadow-amber-400/30'
                    : isTarget
                    ? 'ring-2 ring-emerald-400 bg-emerald-400/15 animate-pulse'
                    : isP1Flag
                    ? 'ring-2 ring-sky-500/80 bg-sky-950/50 shadow-inner'
                    : isP2Flag
                    ? 'ring-2 ring-rose-500/80 bg-rose-950/50 shadow-inner'
                    : 'bg-dark-700/80 hover:bg-dark-600/90'
                } ${item === 'OBSTACLE' ? 'bg-slate-900/95 border border-white/5' : ''}`}
                title={isP1Flag ? '🚩 Căn Cứ Cờ Phe 1 (0,0) - Chiếm để thắng!' : isP2Flag ? '🚩 Căn Cứ Cờ Phe 2 (8,8) - Chiếm để thắng!' : `Ô (${r}, ${c})`}
              >
                {/* Board grid coordinate watermark */}
                <span className="absolute bottom-1 right-1 text-[9px] font-mono text-slate-500 pointer-events-none opacity-60">
                  {r},{c}
                </span>

                {/* Flag Base Watermark Indicator */}
                {(isP1Flag || isP2Flag) && (
                  <span
                    className={`absolute top-1 left-1 text-[9px] font-black px-1 rounded ${
                      isP1Flag ? 'bg-sky-500/30 text-sky-300' : 'bg-rose-500/30 text-rose-300'
                    }`}
                  >
                    🚩 {isP1Flag ? 'P1' : 'P2'}
                  </span>
                )}

                {/* Flag Stand Icon (When cell has no piece) */}
                {(isP1Flag || isP2Flag) && !piece && (
                  <div className="flex flex-col items-center justify-center animate-pulse">
                    <span className="text-xl sm:text-2xl filter drop-shadow">🚩</span>
                    <span className={`text-[8px] font-extrabold uppercase tracking-tighter ${isP1Flag ? 'text-sky-300' : 'text-rose-300'}`}>
                      Căn Cứ
                    </span>
                  </div>
                )}

                {/* Target move indicator dot */}
                {isTarget && !piece && (
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 shadow-md shadow-emerald-400/50"></span>
                )}

                {/* Item / Power-up Potion (if no piece occupies cell and not a flag) */}
                {item && !piece && !isP1Flag && !isP2Flag && (
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-xl sm:text-2xl filter drop-shadow">
                      {ITEM_ICONS[item] || '✨'}
                    </span>
                    <span className="text-[8px] font-bold tracking-tighter text-slate-400 mt-0.5">
                      {item === 'OBSTACLE' ? 'Cản' : item === 'POTION_CLONE' ? '+1 Quân' : item === 'POTION_SPEED' ? 'Đi 2' : 'Đồng Hóa'}
                    </span>
                  </div>
                )}

                {/* Piece Rendering */}
                {piece && (
                  <div
                    className={`w-full h-full p-1 flex flex-col items-center justify-center rounded-lg ${
                      piece.player === 1
                        ? 'text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.7)]'
                        : 'text-rose-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.7)]'
                    }`}
                  >
                    <span className="text-2xl sm:text-3xl">
                      {PIECE_ICONS[piece.type] || piece.type}
                    </span>

                    {/* Active Buff Badges */}
                    <div className="absolute top-1 left-1 flex gap-0.5">
                      {piece.hasInfectionBuff && (
                        <span className="text-[10px] bg-purple-500/80 rounded px-0.5 shadow" title="Buff Đồng Hóa">
                          🧪
                        </span>
                      )}
                      {piece.hasSpeedBuff && (
                        <span className="text-[10px] bg-amber-500/80 rounded px-0.5 shadow" title="Buff Tăng Tốc 2 Bước">
                          ⚡
                        </span>
                      )}
                    </div>

                    {/* Player Badge */}
                    <span
                      className={`text-[8px] font-mono font-bold px-1 rounded-sm mt-0.5 ${
                        piece.player === 1 ? 'bg-sky-500/20 text-sky-300' : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      P{piece.player}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Legend Footer */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-3 border-t border-white/5 text-xs text-slate-400">
        <span className="flex items-center gap-1.5 text-sky-400 font-semibold">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span> Phe 1 (Xanh)
        </span>
        <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span> Phe 2 (Đỏ)
        </span>
        <span className="flex items-center gap-1.5 text-amber-300 font-bold">
          🚩 Căn Cứ Cờ (0,0 & {rows - 1},{cols - 1}) - Đến để Thắng!
        </span>
        <span className="flex items-center gap-1">🧱 Vật cản</span>
        <span className="flex items-center gap-1">🧪 Đồng hóa</span>
        <span className="flex items-center gap-1">⚡ Đi 2 bước</span>
        <span className="flex items-center gap-1">➕ Thêm 1 quân</span>
      </div>
    </div>
  );
}
