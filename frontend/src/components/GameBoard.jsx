import React from 'react';

const PIECE_LABELS = {
  ROCK: { icon: 'rock', name: 'Búa' }, PAPER: { icon: 'paper', name: 'Giấy' }, SCISSORS: { icon: 'scissors', name: 'Kéo' },
  R: { icon: 'rock', name: 'Búa' }, P: { icon: 'paper', name: 'Giấy' }, S: { icon: 'scissors', name: 'Kéo' },
};

const ITEM_LABELS = {
  OBSTACLE: { icon: 'wall', name: 'Vật cản' }, POTION_INFECTION: { icon: 'potion', name: 'Đồng hóa' },
  POTION_SPEED: { icon: 'speed', name: 'Tăng tốc' }, POTION_CLONE: { icon: 'clone', name: 'Thêm quân' },
};

const artwork = {
    rock: <g stroke="#8793ad" strokeWidth="1.2" strokeLinejoin="round">
      <path d="M8 23V13c0-4 5-5 7-2 0-5 7-6 8-1 3-3 8-1 8 3 4 0 5 3 4 7l-2 8c-2 5-6 7-12 7h-4c-6 0-10-4-11-9Z" fill="#e8e9f2"/>
      <path d="M15 11v9m8-10v10m8-7-1 8M9 21h21" fill="none" strokeLinecap="round"/>
      <path d="m9 19 6 5 9-1c5-1 6 5 2 7l-9 3c-4 1-8-1-10-4l-3-5c-2-4 2-8 5-5Z" fill="#e8e9f2"/>
      <path d="m16 27 8-1" fill="none" stroke="#b4bdd1" strokeLinecap="round"/>
    </g>,
    paper: <g stroke="#93a0b9" strokeWidth="1.2" strokeLinejoin="round">
      <path d="M10 4h16l7 7v24H10a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" fill="#f4f0ec"/>
      <path d="M26 4v8h7" fill="#d3daea"/>
      <path d="M13 16h14m-14 5h14m-14 5h11m-11 5h8" stroke="#b1bace" strokeWidth="1.8" strokeLinecap="round"/>
    </g>,
    scissors: <g strokeLinecap="round" strokeLinejoin="round">
      <path d="m13 17 15 18m-2-18L12 35" stroke="#778ca9" strokeWidth="4.5"/>
      <path d="m14 18 13 15m-2-15L13 33" stroke="#c4d1e2" strokeWidth="1.3"/>
      <circle cx="11" cy="11" r="6.2" fill="none" stroke="#fa819a" strokeWidth="3.8"/>
      <circle cx="29" cy="11" r="6.2" fill="none" stroke="#fa819a" strokeWidth="3.8"/>
      <circle cx="20" cy="25" r="2" fill="#e3eaf5"/>
    </g>,
    wall: <g stroke="#9b432d" strokeWidth="1.2" strokeLinejoin="round">
      <rect x="3" y="6" width="34" height="28" rx="3" fill="#ea7854"/>
      <path d="M3 15h34M3 25h34M14 6v9m11-9v9M9 15v10m12-10v10m11-10v10M14 25v9m11-9v9" fill="none"/>
      <path d="M6 9h6m5 0h5m6 0h6" stroke="#ffb08a"/>
    </g>,
    potion: <g strokeLinejoin="round">
      <path d="m23 5 11 10-5 5-2-2-12 15c-3 4-10-2-7-6l13-14-2-2Z" fill="#c7f4e4" stroke="#78afaa" strokeWidth="1.3"/>
      <path d="m12 23 8-8 7 6-10 12c-3 3-8-1-7-4Z" fill="#68d9a5"/>
      <path d="m23 4 12 11" stroke="#9ed8ef" strokeWidth="5" strokeLinecap="round"/>
      <path d="m12 27 5-6" stroke="#e6fff6" strokeWidth="2" strokeLinecap="round"/>
    </g>,
    speed: <g strokeLinejoin="round"><path d="m23 3-17 21h12l-2 13 18-22H22Z" fill="#ffc568" stroke="#e39431" strokeWidth="1.5"/><path d="m23 8-10 13h8" fill="none" stroke="#ffe3a8" strokeWidth="2"/></g>,
    clone: <g strokeLinecap="round"><path d="M20 7v26M7 20h26" stroke="#7e6cd6" strokeWidth="8"/><path d="M19 7v25M7 19h25" stroke="#b3a1ff" strokeWidth="4"/></g>,
    flag: <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><path d="M10 35V5m0 1c8-7 14 7 23 0v17c-9 7-15-7-23 0" fill="currentColor" fillOpacity=".2"/><path d="M5 35h12"/></g>,
};
export function BoardGlyph({ kind, className = '' }) {
  return <svg className={`board-glyph ${className}`} viewBox="0 0 40 40" aria-hidden="true" focusable="false">{artwork[kind] || artwork.flag}</svg>;
}

function GameBoard({ grid: propGrid, board, selectedPiece = null, validMoves = [], onTileClick = () => {}, readOnly = false, isInteractive = true, disabled = false, lastMove = null }) {
  let grid = propGrid || board || [];
  if (typeof grid === 'string') {
    try { grid = JSON.parse(grid); } catch { grid = []; }
  }

  const rows = Array.isArray(grid) ? grid.length : 0;
  const cols = rows > 0 && Array.isArray(grid[0]) ? grid[0].length : 0;
  const isReadOnly = readOnly || isInteractive === false || disabled;

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
  const pieceCounts = grid.flat().reduce((counts,cell) => {
    if (cell?.piece?.player === 1 || cell?.piece?.player === 2) counts[cell.piece.player]++;
    return counts;
  }, {1:0,2:0});

  return (
    <section className="game-board-shell" aria-label={`Bàn đấu ${rows} hàng ${cols} cột`}>
      <div className="board-heading">
        <div><span className="board-eyebrow">Đấu trường chiến thuật</span><strong>{rows} × {cols}</strong></div>
        <div className="board-player-key" aria-label="Chú thích hai phe">
          <span><i className="player-dot player-dot-one" />Xanh <b>{pieceCounts[1]}</b></span>
          <span><i className="player-dot player-dot-two" />Đỏ <b>{pieceCounts[2]}</b></span>
        </div>
      </div>

      <div className="board-frame">
        <div className="tactical-board" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {grid.map((rowArr, r) => rowArr.map((cell, c) => {
            const piece = cell?.piece || null;
            const item = cell?.item || null;
            const pieceMeta = piece ? (PIECE_LABELS[piece.type] || { icon: 'rock', name: piece.type }) : null;
            const itemMeta = item ? (ITEM_LABELS[item] || { icon: 'potion', name: item }) : null;
            const isSelected = selectedPiece && selectedPiece.row === r && selectedPiece.col === c;
            const isTarget = isMoveTarget(r, c);
            const isP1Base = r === 0 && c === 0;
            const isP2Base = r === rows - 1 && c === cols - 1;
            const isLastFrom = lastMove?.fromRow === r && lastMove?.fromCol === c;
            const isLastTo = lastMove?.toRow === r && lastMove?.toCol === c;
            const cellClasses = ['board-cell-pro', (r + c) % 2 === 0 ? 'is-light' : 'is-shade', isP1Base ? 'is-base-one' : '', isP2Base ? 'is-base-two' : '', piece ? 'has-piece' : '', item === 'OBSTACLE' ? 'is-obstacle' : '', isLastFrom ? 'is-last-from' : '', isLastTo ? 'is-last-to' : '', isSelected ? 'is-selected' : '', isTarget ? 'is-target' : '', isReadOnly ? 'is-readonly' : 'is-clickable'].filter(Boolean).join(' ');
            const description = [piece ? `${pieceMeta.name}, phe ${piece.player}` : itemMeta?.name,
              isP1Base ? 'Căn cứ phe Xanh' : isP2Base ? 'Căn cứ phe Đỏ' : null, `Ô ${r}, ${c}`].filter(Boolean).join(' · ');

            return (
              <button type="button" key={`${r}-${c}`} className={cellClasses} onClick={() => !isReadOnly && onTileClick(r, c)} disabled={isReadOnly} title={description} aria-label={description} aria-pressed={piece && !isReadOnly ? Boolean(isSelected) : undefined}>
                <span className="board-coordinate">{r},{c}</span>
                {(isP1Base || isP2Base) && (
                  <span className={`base-marker ${isP1Base ? 'base-one' : 'base-two'} ${piece ? 'is-occupied' : ''}`}><BoardGlyph kind="flag" />{!piece && <small>Căn cứ P{isP1Base ? 1 : 2}</small>}</span>
                )}
                {isTarget && !piece && <span className="target-marker" />}
                {item && !piece && !isP1Base && !isP2Base && (
                  <span className={`board-item item-${itemMeta.icon}`}><BoardGlyph kind={itemMeta.icon} /><small>{itemMeta.name}</small></span>
                )}
                {piece && (
                  <span className={`piece-token player-${piece.player}`}>
                    <span className="piece-buffs">
                      {piece.hasInfectionBuff && <i className="buff-infection" title="Đồng hóa"><BoardGlyph kind="potion" /></i>}
                      {piece.hasSpeedBuff && <i className="buff-speed" title="Tăng tốc">2X</i>}
                    </span>
                    <BoardGlyph kind={pieceMeta.icon} className="piece-art" /><em>P{piece.player}</em>
                  </span>
                )}
              </button>
            );
          }))}
        </div>
      </div>

      <div className="board-legend" aria-label="Quy tắc và vật phẩm">
        <span><BoardGlyph kind="rock" />Búa</span><span><BoardGlyph kind="paper" />Giấy</span><span><BoardGlyph kind="scissors" />Kéo</span><span className="legend-separator" />
        {Object.entries(ITEM_LABELS).map(([type,meta]) => <span key={type} className={`legend-item item-${meta.icon}`}><BoardGlyph kind={meta.icon} />{meta.name}</span>)}
      </div>
    </section>
  );
}
export default React.memo(GameBoard);
