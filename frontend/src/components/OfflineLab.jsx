import React,{useEffect,useRef,useState} from 'react';
import {downloadOfflinePackage,runtimeAssets,sandboxDocument} from '../lib/offlinePackage';
import GameBoard from './GameBoard';
export default function OfflineLab({source}){
  const [status,setStatus]=useState(''),[busy,setBusy]=useState(false),[grid,setGrid]=useState(null),[level,setLevel]=useState('EASY'),[size,setSize]=useState(9);
  const iframe=useRef(),engine=useRef(),timer=useRef(),active=useRef(false),sandboxReady=useRef(false),pendingInit=useRef(null),code=useRef('');
  const stop=()=>{active.current=false;pendingInit.current=null;clearTimeout(timer.current);engine.current?.terminate();engine.current=null;iframe.current?.contentWindow?.postMessage({type:'stop'},'*');setBusy(false);};
  useEffect(()=>{
    const receive=event=>{
      if(event.source!==iframe.current?.contentWindow)return;
      if(event.data.type==='sandbox-ready'){sandboxReady.current=true;if(pendingInit.current){iframe.current.contentWindow.postMessage(pendingInit.current,'*');pendingInit.current=null;}return;}
      if(!active.current)return;
      if(event.data.type==='ready'){
        clearTimeout(timer.current);engine.current.postMessage({type:'start',size,level});
      }else if(event.data.type==='move'){
        clearTimeout(timer.current);engine.current.postMessage(event.data);
      }else if(event.data.type==='error'){stop();setStatus(event.data.message);}
    };
    window.addEventListener('message',receive);return()=>{window.removeEventListener('message',receive);stop();};
  },[size,level]);
  const download=async()=>{setBusy(true);try{const bytes=await downloadOfflinePackage(setStatus);setStatus(`Gói ngoại tuyến sẵn sàng · ${(bytes/1048576).toFixed(1)} MB Python. Có thể mở lại trang và thử bot khi mất mạng.`);}catch(error){setStatus(error.message);}finally{setBusy(false);}};
  const run=async()=>{
    if(!source?.trim()){setStatus('Hãy nhập mã Python hoặc chọn file trước khi thử.');return;}
    stop();setBusy(true);setGrid(null);active.current=true;code.current=source;
    try{
      const assets=await runtimeAssets();if(!active.current)return;
      setStatus('Đang khởi động Python trên thiết bị…');
      engine.current=new Worker('/offline-engine.js');
      engine.current.onerror=()=>{stop();setStatus('Không mở được bộ luật ngoại tuyến. Hãy tải lại gói.');};
      engine.current.onmessage=event=>{
        const data=event.data;
        if(data.type==='board'){
          setGrid(data.grid);setStatus(data.over?`Đấu thử hoàn tất · ${data.turn} lượt · ${data.winner?`Phe ${data.winner} thắng`:'Hòa'} (${data.reason})`:`Đấu thử trên máy · lượt ${data.turn}`);
          if(data.over)stop();
        }else if(data.type==='input'){
          timer.current=setTimeout(()=>{stop();setStatus('Bot quá thời gian thử trên thiết bị (3 giây/lượt). Đã dừng để tránh treo trang.');},3000);
          iframe.current.contentWindow.postMessage({type:'run',source:code.current,input:data.input},'*');
        }else{stop();setStatus(data.message);}
      };
      const init={type:'init',assets};
      if(sandboxReady.current)iframe.current.contentWindow.postMessage(init,'*');else pendingInit.current=init;
      timer.current=setTimeout(()=>{stop();setStatus('Khởi động Python quá lâu. Hãy thử tải lại gói ngoại tuyến.');},60000);
    }catch(error){stop();setStatus(error.message);}
  };
  return <section className="safety-panel my-5"><h2>Phòng thử bot ngoại tuyến</h2><p>Python tiêu chuẩn, chạy trên thiết bị. Kết quả chỉ để thử, không tính điểm. Tải gói khi có mạng; dung lượng hiển thị theo thực tế. Trình duyệt có thể thu hồi bộ nhớ lưu khi thiết bị thiếu dung lượng.</p>
    <div className="flex flex-wrap gap-3 mt-4"><button className="secondary-action" disabled={busy} onClick={download}>Tải gói offline</button><label>Bàn cờ <select disabled={busy} value={size} onChange={e=>setSize(Number(e.target.value))}><option value={8}>8×8</option><option value={9}>9×9</option></select></label><label>Boss <select disabled={busy} value={level} onChange={e=>setLevel(e.target.value)}><option value="EASY">Heuristic</option><option value="MEDIUM">Tốc độ</option><option value="HARD">Alpha-Beta</option><option value="GRANDMASTER">A*</option></select></label><button className="primary-action" disabled={busy} onClick={run}>Đấu thử trên máy</button>{busy&&active.current&&<button className="secondary-action" onClick={()=>{stop();setStatus('Đã dừng đấu thử.');}}>Dừng</button>}</div>
    <p role="status" className="mt-3">{status}</p>{grid&&<div className="max-w-2xl mx-auto mt-4"><GameBoard grid={grid} readOnly /></div>}
    <iframe title="Python sandbox" sandbox="allow-scripts" srcDoc={sandboxDocument} ref={iframe} hidden />
  </section>;
}
