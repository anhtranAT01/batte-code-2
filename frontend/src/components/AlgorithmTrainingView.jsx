import React, {useState,useEffect,useRef} from 'react';
import Icon from './Icons';
import TrainingBoard from './TrainingBoard';
import {ALGORITHMS} from './trainingLessons';
import './LearningViews.css';

const LABELS={currentPos:'Ô đang xét',gn:'g(n) · Đã đi',hn:'h(n) · Ước tính',fn:'f(n) · Tổng',openNodes:'Ô chờ xét',closedNodes:'Ô đã xét',targetPos:'Cờ mục tiêu',depth:'Độ sâu',alpha:'Cận dưới α',beta:'Cận trên β',evaluatedNodes:'Nút đã xét',cutoffs:'Nhánh đã tỉa',pieceAdvantage:'Chênh lệch quân',counterScore:'Điểm khắc chế',flagBonus:'Điểm tiếp cận cờ',totalScore:'Tổng điểm'};
const SHORT_SUMMARIES=['Tìm đường tới cờ và tránh vật cản.','So sánh nước đi với phản công của đối thủ.','Chấm điểm quân số, vị trí và tương khắc.'];
const SHORT_NAMES=['Tìm đường A*','Minimax & Alpha-Beta','Đánh giá Heuristic'];

export default function AlgorithmTrainingView({onGoToBots}) {
  const [selectedAlgo,setSelectedAlgo]=useState(ALGORITHMS[0]);
  const [currentStep,setCurrentStep]=useState(0);
  const [isPlaying,setIsPlaying]=useState(false);
  const [speedMs,setSpeedMs]=useState(1400);
  const steps=selectedAlgo.steps,step=steps[currentStep];
  const codeRef=useRef(null);
  useEffect(()=>{
    const panel=codeRef.current,line=panel?.querySelector('[data-active="true"]');
    if(!line)return;
    const top=line.offsetTop,bottom=top+line.offsetHeight;
    if(top<panel.scrollTop+8)panel.scrollTop=Math.max(0,top-8);
    else if(bottom>panel.scrollTop+panel.clientHeight-8)panel.scrollTop=bottom-panel.clientHeight+8;
  },[selectedAlgo,currentStep]);
  const goTo=index=>{setIsPlaying(false);setCurrentStep(index);};
  useEffect(()=>{
    if(!isPlaying)return;
    if(currentStep===steps.length-1){setIsPlaying(false);return;}
    const timer=setTimeout(()=>setCurrentStep(index=>index+1),speedMs);
    return ()=>clearTimeout(timer);
  },[isPlaying,currentStep,speedMs,steps.length]);
  const play=()=>{if(!isPlaying && currentStep===steps.length-1)setCurrentStep(0);setIsPlaying(value=>!value);};
  return <div className="view-shell learning-view training-view">
    <header className="learning-header">
      <div><span className="learning-kicker"><Icon name="algorithm" size={15} /> PHÒNG THỰC HÀNH AI</span>
        <h1>Học cách bot suy nghĩ</h1><p>Nhìn từng nước đi, hiểu từng quyết định. Khám phá thuật toán bằng bàn cờ và mã giả đặt cạnh nhau.</p></div>
      {onGoToBots && <button type="button" className="secondary-action" onClick={onGoToBots}><Icon name="code" size={16} />Mở Kho bot <span aria-hidden="true">↗</span></button>}
    </header>
    <div className="learning-howto" aria-label="Cách sử dụng bài học"><span><b>01</b>Chọn thuật toán</span><i aria-hidden="true">→</i><span><b>02</b>Xem từng bước trên bàn cờ</span><i aria-hidden="true">→</i><span><b>03</b>Đối chiếu dòng mã được tô sáng</span></div>
    <div className="lesson-picker" aria-label="Chọn thuật toán để học">
      {ALGORITHMS.map((algo,index)=><button type="button" key={algo.id} className="lesson-option" data-tone={['blue','violet','green'][index]} aria-pressed={selectedAlgo.id===algo.id}
        onClick={()=>{setIsPlaying(false);setSelectedAlgo(algo);setCurrentStep(0);}}>
        <span className="lesson-option-top"><span className="learning-tag">{algo.difficulty}</span><span className="lesson-option-index">0{index+1}</span></span>
        <strong>{SHORT_NAMES[index]}</strong><span className="lesson-option-description">{SHORT_SUMMARIES[index]}</span>
        <span className="lesson-option-bottom">{algo.steps.length} bước minh họa <Icon name={selectedAlgo.id===algo.id?'check':'chevronRight'} size={16} /></span>
      </button>)}
    </div>
    <div className="training-workspace">
      <section className="learning-panel training-board-panel" aria-label="Mô phỏng bàn cờ">
        <div className="lesson-panel-heading"><div><span className="learning-kicker">QUAN SÁT TRÊN BÀN CỜ</span><h2>{selectedAlgo.badge}</h2></div><span className="learning-tag">Ví dụ minh họa</span></div>
        <TrainingBoard lesson={selectedAlgo} step={step} />
        <div className="lesson-timeline" aria-label="Chọn bước minh họa">{steps.map((item,index)=><button key={index} type="button" aria-label={`Bước ${index+1}: ${item.title}`} aria-current={index===currentStep?'step':undefined} onClick={()=>goTo(index)}><span>{index+1}</span><i aria-hidden="true" /></button>)}</div>
        <div className="lesson-playback" aria-label="Điều khiển bài học">
          <div className="lesson-playback-buttons">
            <button type="button" className="icon-button" onClick={()=>goTo(0)} aria-label="Bắt đầu lại từ bước 1" title="Bắt đầu lại"><Icon name="rotateCcw" size={17} /></button>
            <button type="button" className="icon-button" onClick={()=>goTo(currentStep-1)} disabled={currentStep===0} aria-label="Bước trước"><Icon name="stepBack" size={17} /></button>
            <button type="button" className="primary-action lesson-play-button" onClick={play}><Icon name={isPlaying?'pause':'play'} size={15} />{isPlaying?'Tạm dừng':currentStep===steps.length-1?'Xem lại':'Tự động xem'}</button>
            <button type="button" className="icon-button" onClick={()=>goTo(currentStep+1)} disabled={currentStep===steps.length-1} aria-label="Bước kế tiếp"><Icon name="stepForward" size={17} /></button>
          </div>
          <label className="lesson-speed">Tốc độ<select aria-label="Tốc độ bài học" value={speedMs} onChange={event=>setSpeedMs(Number(event.target.value))}><option value="2000">Chậm · 2 giây</option><option value="1400">Vừa · 1,4 giây</option><option value="800">Nhanh · 0,8 giây</option></select></label>
        </div>
        <p className="lesson-demo-note"><Icon name="info" size={14} />Bàn 7×7 dùng để học nguyên lý. Đây là các tình huống dựng sẵn, không phải một trận thi đấu hay kết quả tìm kiếm trực tiếp.</p>
      </section>
      <aside className="training-explanation">
        <section className="learning-panel lesson-explanation" aria-label="Giải thích bước hiện tại">
          <span className="learning-kicker">BƯỚC {currentStep+1} / {steps.length}</span><h2>{step.title}</h2><p className="lesson-step-description">{step.desc}</p>
          <div className="lesson-metrics">{Object.entries(step.stats).map(([key,value])=><div key={key}><span>{LABELS[key] || key}</span><strong>{value}</strong></div>)}</div>
          {selectedAlgo.id==='minimax' && <div className="lesson-branch-comparison"><span>Nhánh A <b>{currentStep>0?'+12':'?'}</b></span><span className={currentStep>=2?'is-pruned':''}>Nhánh B <b>{currentStep>=2?'≤ +8 · Tỉa':'?'}</b></span></div>}
        </section>
        <section className="learning-panel lesson-code-panel" aria-label="Mã giả thuật toán">
          <div className="lesson-code-heading"><h2><Icon name="code" size={16} />Theo dõi mã giả</h2><span>Python · minh họa</span></div>
          <div ref={codeRef} className="lesson-code" tabIndex="0" aria-label="Mã giả có thể cuộn ngang">{selectedAlgo.pseudocode.map((line,index)=><div className="lesson-code-line" key={index} data-active={index===step.activeLine} aria-current={index===step.activeLine?'true':undefined}><span aria-hidden="true">{index+1}</span><code>{line}</code></div>)}</div>
          <p className="lesson-code-caption"><i aria-hidden="true" />Dòng màu xanh ứng với bước đang giải thích.</p>
        </section>
        <details className="learning-panel lesson-glossary"><summary>Hiểu các chỉ số trên màn hình <Icon name="chevronDown" size={15} /></summary><p>{selectedAlgo.id==='astar'?'g(n) là số lượt đã đi; h(n) ước tính số lượt còn lại; f(n) = g(n) + h(n). Ví dụ cho phép đi 8 hướng, dùng khoảng cách Chebyshev.':selectedAlgo.id==='minimax'?'Alpha là mức tốt nhất bên tối đa hóa đã biết; beta là mức tốt nhất bên tối thiểu hóa đã biết. Khi beta ≤ alpha, ta có thể bỏ qua các lựa chọn còn lại của nhánh đó.':'Điểm lớn hơn thể hiện thế cờ được ưu tiên theo hàm đánh giá đang dùng. Các trọng số và điểm ở đây là ví dụ, bạn có thể điều chỉnh khi viết bot.'}</p></details>
      </aside>
    </div>
    <div className="learning-tip" data-tone="blue"><Icon name="sparkles" size={20} /><div><strong>Học xong, thử một thay đổi nhỏ</strong><p>Chọn bot mẫu trong Kho bot, thay một trọng số hoặc mục tiêu, rồi đấu thử với Boss để quan sát sự khác biệt.</p></div>{onGoToBots && <button type="button" className="secondary-action" onClick={onGoToBots}>Thử với bot mẫu <Icon name="chevronRight" size={14} /></button>}</div>
  </div>;
}
