import React, {useEffect,useId,useState} from 'react';
import {BoardGlyph} from './GameBoard';

const same=([a,b],r,c)=>a===r && b===c;
export default function TrainingBoard({lesson,step}) {
  const [inspected,setInspected]=useState(null);
  const gridId=useId();
  useEffect(()=>setInspected(null),[lesson.id,step]);
  const state=step.gridState;
  const current=state.highlight.at(-1),start=lesson.steps[0].gridState.path[0];
  const pieces=lesson.id==='heuristic'
    ? [{at:step.stepIndex===2?[3,4]:[1,1],kind:'paper',team:1},{at:[1,2],kind:'rock',team:1},{at:[2,1],kind:'scissors',team:1},{at:[1,3],kind:'scissors',team:2},{at:[5,2],kind:'paper',team:2}]
    : [{at:current,kind:lesson.id==='minimax'?'scissors':'rock',team:1},...(lesson.id==='minimax'?[{at:[1,1],kind:'rock',team:2}]:[])];
  const describe=(r,c)=>{
    const labels=[];
    const piece=pieces.find(p=>same(p.at,r,c));
    if(piece)labels.push(`${{rock:'Búa',paper:'Giấy',scissors:'Kéo'}[piece.kind]} phe ${piece.team===1?'Xanh':'Đỏ'}`);
    if(same(state.target,r,c))labels.push('Cờ mục tiêu');
    if(state.obstacles.some(p=>same(p,r,c)))labels.push('Vật cản — không thể đi vào');
    if(same(current,r,c))labels.push('Đang xét');
    if(state.path.some(p=>same(p,r,c)))labels.push(lesson.id==='astar'?'Đường đã chọn':'Nước đi đang minh họa');
    if(!labels.length && state.visited.some(p=>same(p,r,c)))labels.push('Đã xét');
    return `Ô (${r}, ${c}) · ${labels.join(' · ') || 'Ô trống'}`;
  };
  const selected=inspected || current;
  const onKey=(event,r,c)=>{
    const offsets={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]};
    if(!offsets[event.key])return;
    event.preventDefault();const [dr,dc]=offsets[event.key];
    event.currentTarget.closest('[role="grid"]').querySelector(`[data-cell="${Math.max(0,Math.min(6,r+dr))}-${Math.max(0,Math.min(6,c+dc))}"]`)?.focus();
  };
  return <figure className="lesson-board" aria-label="Bàn cờ minh họa thuật toán">
    <div className="lesson-board-heading"><span><i className="lesson-live-dot" />Bàn cờ minh họa</span><b>7 × 7</b></div>
    <div className="lesson-column-axis" aria-hidden="true">{Array.from({length:7},(_,i)=><span key={i}>{i}</span>)}</div>
    <div className="lesson-board-main">
      <div className="lesson-row-axis" aria-hidden="true">{Array.from({length:7},(_,i)=><span key={i}>{i}</span>)}</div>
      <div className="lesson-square-area">
        <svg className="lesson-route" viewBox="0 0 700 700" aria-hidden="true"><polyline points={state.path.map(([r,c])=>`${c*100+50},${r*100+50}`).join(' ')} /></svg>
        <div className="lesson-grid" role="grid" aria-label="Bàn cờ 7 hàng 7 cột. Dùng phím mũi tên để xem các ô." aria-describedby={`${gridId}-detail`}>
          {Array.from({length:7},(_,r)=><div className="lesson-grid-row" role="row" key={r}>
            {Array.from({length:7},(_,c)=>{
              const obstacle=state.obstacles.some(p=>same(p,r,c));
              const target=same(state.target,r,c),active=state.highlight.some(p=>same(p,r,c));
              const pathIndex=state.path.findIndex(p=>same(p,r,c));
              const visited=state.visited.some(p=>same(p,r,c));
              const piece=pieces.find(p=>same(p.at,r,c));
              const cutoff=lesson.id==='minimax' && step.stepIndex>=2 && r===2 && c===1;
              return <button key={c} type="button" role="gridcell" data-cell={`${r}-${c}`} aria-label={describe(r,c)}
                tabIndex={same(selected,r,c)?0:-1} aria-selected={Boolean(inspected && same(inspected,r,c))}
                onClick={()=>setInspected([r,c])} onFocus={()=>setInspected([r,c])} onKeyDown={event=>onKey(event,r,c)}
                className={`lesson-cell ${(r+c)%2?'is-shade':''} ${obstacle?'is-wall':''} ${target?'is-goal':''} ${pathIndex>=0?'is-route':''} ${active?'is-current':''} ${cutoff?'is-cutoff':''}`}>
                {!piece && !target && !obstacle && visited && <span className="lesson-visited-dot" />}
                {obstacle && <BoardGlyph kind="wall" />}
                {target && <span className={`lesson-goal ${piece?'is-occupied':''}`}><BoardGlyph kind="flag" /></span>}
                {piece && <span className={`lesson-piece team-${piece.team}`}><BoardGlyph kind={piece.kind} /></span>}
                {cutoff && <span className="lesson-cutoff-mark" aria-hidden="true">×</span>}
                {pathIndex>=0 && <small className="lesson-path-index">{pathIndex}</small>}
                {same(start,r,c) && !piece && !target && <small className="lesson-start-marker">ĐIỂM ĐẦU</small>}
              </button>;
            })}
          </div>)}
        </div>
      </div>
    </div>
    <figcaption className="lesson-board-caption"><span>Hàng ↓ · Cột →</span><span>Tọa độ: (hàng, cột)</span></figcaption>
    <ul className="lesson-board-key" aria-label="Chú giải bàn cờ">
      <li><i className="key-team-one" />Quân Xanh</li>{lesson.id!=='astar' && <li><i className="key-team-two" />Quân Đỏ</li>}
      <li><i className="key-current" />Đang xét</li><li><i className="key-route" />{lesson.id==='astar'?'Đường đã chọn':'Nhánh minh họa'}</li>
      <li><i className="key-visited" />Đã xét</li><li><BoardGlyph kind="wall" />Vật cản</li><li><BoardGlyph kind="flag" />Cờ đích</li>
    </ul>
    <div id={`${gridId}-detail`} className="lesson-cell-detail" role="status">{inspected?describe(...inspected):'Chọn một ô trên bàn cờ để xem ý nghĩa. Có thể dùng các phím mũi tên.'}</div>
  </figure>;
}
