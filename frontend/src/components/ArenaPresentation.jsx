import React from 'react';
import Icon from './Icons';
import {BoardGlyph} from './GameBoard';

// Decorative preview only: no engine, requests or match state.
const previewPieces={0:'rock',1:'paper',2:'scissors',3:'rock',8:'paper',12:'scissors',36:'rock',40:'paper',45:'scissors',46:'rock',47:'paper',48:'scissors'};
const previewItems={17:'wall',23:'potion',25:'speed',31:'wall'};

export function ArenaShowcase() {
  return <div className="arena-showcase" aria-hidden="true">
    <div className="showcase-orbit" />
    <div className="showcase-topline"><span>BÀN CỜ MINH HỌA</span><b>7 × 7</b></div>
    <div className="showcase-stage"><div className="showcase-board">
      {Array.from({length:49},(_,index)=><div key={index} className={`showcase-cell ${(Math.floor(index/7)+index)%2?'is-shade':''}`}>
        {previewPieces[index] ? <span className={`showcase-piece ${index>24?'is-red':''}`}><BoardGlyph kind={previewPieces[index]} /></span>
          : previewItems[index] ? <BoardGlyph kind={previewItems[index]} /> : null}
      </div>)}
    </div></div>
    <div className="showcase-code"><div><i/><i/><i/><span>chiến_thuật.py</span></div><code><b>def</b> choose_move(state):<br />&nbsp; <b>return</b> best_strategy(state)</code><Icon name="code" size={23}/></div>
    <div className="showcase-caption"><span className="showcase-team">XANH</span><span>Mỗi dòng mã. Một thế trận.</span><span className="showcase-team is-red">ĐỎ</span></div>
  </div>;
}

export function ArenaModeCard({tone='blue',icon,title,description,action,onClick}) {
  return <button type="button" className="arena-mode-card" data-tone={tone} onClick={onClick}>
    <span className="mode-card-icon"><Icon name={icon} size={24}/></span>
    <span className="mode-card-copy"><strong>{title}</strong><span>{description}</span><b>{action}<Icon name="chevronRight" size={14}/></b></span>
    <span className="mode-card-watermark" aria-hidden="true"><Icon name={icon} size={75}/></span>
  </button>;
}

export function MatchOutcome({tone='victory',children}) {
  return <section className="match-outcome" data-outcome={tone} aria-label="Kết quả trận đấu">
    <div className="outcome-medal" aria-hidden="true"><Icon name={tone==='victory'?'trophy':tone==='draw'?'swords':'admin'} size={28}/></div>
    <div className="outcome-copy">{children}</div>
  </section>;
}
