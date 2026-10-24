import React from 'react';

const PIECE_LABELS = {
  ROCK: { short: 'B', name: 'Búa' }, PAPER: { short: 'G', name: 'Giấy' }, SCISSORS: { short: 'K', name: 'Kéo' },
  R: { short: 'B', name: 'Búa' }, P: { short: 'G', name: 'Giấy' }, S: { short: 'K', name: 'Kéo' },
};

const ITEM_LABELS = {
  OBSTACLE: { short: 'CHẶN', name: 'Vật cản' }, POTION_INFECTION: { short: 'ĐỔI', name: 'Đồng hóa' },
  POTION_SPEED: { short: '2X', name: 'Đi hai bước' }, POTION_CLONE: { short: '+1', name: 'Thêm quân' },
};

export default function GameBoard({ grid: propGrid, board, selectedPiece = null, validMoves = [], onTileClick = () => {}, readOnly = false, isInteractive = true }) {
  let grid = propGrid || board || [];
  if (typeof grid === 'string') {
    try { grid = JSON.parse(grid); } catch { grid = []; }
  }

  const rows = Array.isArray(grid) ? grid.length : 0;
  const cols = rows > 0 && Array.isArray(grid[0]) ? grid[0].length : 0;
  const isReadOnly = readOnly || isInteractive === false;

  if (rows === 0 || cols === 0) {
    return (
      <div className="board-empty-state">
        <span className="board-empty-mark">9×9</span>
        <div><strong>Đang khởi tạo bàn đấu</strong><span>Dữ liệu trận đấu sẽ xuất hiện tại đây.</span></div>
      </div>
    );
  }

  const isMoveTarget = (r, c) => selectedPiece && Array.isArray(validMoves) && validMoves.some(
    (move) => move.fromRow === selectedPiece.row && move.fromCol === selectedPiece.col && move.toRow === r && move.toCol === c
  );

  return (
    <section className="game-board-shell" aria-label={`Bàn đấu ${rows} hàng ${cols} cột`}>
      <div className="board-heading">
        <div><span className="board-eyebrow">Bàn đấu chiến thuật</span><strong>{rows} × {cols} ô</strong></div>
        <div className="board-player-key" aria-label="Chú thích hai phe">
          <span><i className="player-dot player-dot-one" />Phe 1</span>
          <span><i className="player-dot player-dot-two" />Phe 2</span>
        </div>
      </div>

      <div className="board-frame">
        <div className="tactical-board" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {grid.map((rowArr, r) => rowArr.map((cell, c) => {
            const piece = cell?.piece || null;
            const item = cell?.item || null;
            const pieceMeta = piece ? (PIECE_LABELS[piece.type] || { short: piece.type, name: piece.type }) : null;
            const itemMeta = item ? (ITEM_LABELS[item] || { short: 'VẬT', name: item }) : null;
            const isSelected = selectedPiece && selectedPiece.row === r && selectedPiece.col === c;
            const isTarget = isMoveTarget(r, c);
            const isP1Base = r === 0 && c === 0;
            const isP2Base = r === rows - 1 && c === cols - 1;
            const cellClasses = ['board-cell-pro', (r + c) % 2 === 0 ? 'is-light' : 'is-shade', isP1Base ? 'is-base-one' : '', isP2Base ? 'is-base-two' : '', item === 'OBSTACLE' ? 'is-obstacle' : '', isSelected ? 'is-selected' : '', isTarget ? 'is-target' : '', isReadOnly ? 'is-readonly' : 'is-clickable'].filter(Boolean).join(' ');

            return (
              <button type="button" key={`${r}-${c}`} className={cellClasses} onClick={() => !isReadOnly && onTileClick(r, c)} disabled={isReadOnly} title={isP1Base ? 'Căn cứ Phe 1' : isP2Base ? 'Căn cứ Phe 2' : `Ô ${r}, ${c}`} aria-label={piece ? `${pieceMeta.name}, phe ${piece.player}, ô ${r} ${c}` : `Ô ${r} ${c}`}>
                <span className="board-coordinate">{r},{c}</span>
                {(isP1Base || isP2Base) && !piece && (
                  <span className={`base-marker ${isP1Base ? 'base-one' : 'base-two'}`}><b>{isP1Base ? 'P1' : 'P2'}</b><small>Căn cứ</small></span>
                )}
                {isTarget && !piece && <span className="target-marker" />}
                {item && !piece && !isP1Base && !isP2Base && (
                  <span className="board-item"><b>{itemMeta.short}</b><small>{itemMeta.name}</small></span>
                )}
                {piece && (
                  <span className={`piece-token player-${piece.player}`}>
                    <span className="piece-buffs">
                      {piece.hasInfectionBuff && <i title="Đồng hóa">Đ</i>}
                      {piece.hasSpeedBuff && <i title="Tăng tốc">2X</i>}
                    </span>
                    <b>{pieceMeta.short}</b><small>{pieceMeta.name}</small><em>P{piece.player}</em>
                  </span>
                )}
              </button>
            );
          }))}
        </div>
      </div>

      <div className="board-legend" aria-label="Quy tắc và vật phẩm">
        <span><b>B</b>Búa</span><span><b>G</b>Giấy</span><span><b>K</b>Kéo</span><span className="legend-separator" />
        <span>CHẶN <small>Vật cản</small></span><span>ĐỔI <small>Đồng hóa</small></span><span>2X <small>Tăng tốc</small></span><span>+1 <small>Thêm quân</small></span>
      </div>
    </section>
  );
}
