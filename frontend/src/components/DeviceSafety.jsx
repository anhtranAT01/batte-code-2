import React,{useEffect,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {outbox,subscribeOutbox} from '../lib/outbox';

export function downloadBackup(filename,data){
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function uniqueEntries(entries,receipts){
  const combined=[...entries,...receipts.filter(r=>!entries.some(e=>e.id===r.id)).map(r=>({id:r.id,kind:'bot',payload:{name:r.name},state:'received',receipt:r}))];
  const seen=new Set();
  return combined.sort((a,b)=>(b.createdAt||b.receivedAt||0)-(a.createdAt||a.receivedAt||0)).filter(entry=>{
    const key=entry.kind==='tournament'&&entry.payload?.tournamentId
      ?`tournament:${entry.userId}:${entry.payload.tournamentId}`:`id:${entry.id}`;
    if(seen.has(key))return false;seen.add(key);return true;
  });
}

export default function DeviceSafety(){
  const {user,getAuthHeaders}=useAuth();
  const [entries,setEntries]=useState([]),[receipts,setReceipts]=useState([]),[error,setError]=useState('');
  const [receiptOwner,setReceiptOwner]=useState(null),[expanded,setExpanded]=useState(false);
  useEffect(()=>{
    let active=true;
    const refresh=async()=>{try{const list=user?await outbox.list(user.id):[];if(active)setEntries(list);}catch{if(active)setError('Kho lưu thiết bị không khả dụng. Hãy tải bản dự phòng trước khi rời trang.');}};
    setEntries([]);setReceipts([]);setReceiptOwner(null);refresh();
    const unsubscribe=subscribeOutbox(refresh);
    return()=>{active=false;unsubscribe();};
  },[user?.id]);
  useEffect(()=>{
    if(!expanded||!user)return;
    let active=true;
    const server=async()=>{if(globalThis.navigator?.onLine===false)return;const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);try{const res=await fetch('/api/support/submissions',{headers:getAuthHeaders(),signal:controller.signal});if(res.ok){const data=await res.json();if(active){setReceipts(data.data||[]);setReceiptOwner(user.id);}}}catch{}finally{clearTimeout(timeout);}};
    server();const timer=setInterval(server,30000);window.addEventListener('online',server);
    return()=>{active=false;clearInterval(timer);window.removeEventListener('online',server);};
  },[expanded,user?.id]);

  const visibleReceipts=receiptOwner===user?.id?receipts:[];
  const merged=uniqueEntries(entries.filter(entry=>entry.userId===user?.id),visibleReceipts);
  const active=merged.filter(entry=>entry.state!=='received');
  const completed=merged.filter(entry=>entry.state==='received');
  const states={pending:'Máy chủ đã nhận · chờ máy chấm',processing:'Máy chủ đang kiểm tra',accepted:'Đã kiểm tra · có trong Kho bot',rejected:'Máy chủ từ chối'};
  const renderEntry=entry=>{
    const receipt=visibleReceipts.find(r=>r.id===entry.id)||entry.receipt;
    return <article key={entry.id} className="safety-row">
      <div className="min-w-0"><strong>{entry.payload?.name|| (entry.kind==='question'?'Câu hỏi gửi Ban tổ chức':'Đăng ký giải đấu')}</strong>
        <small className="block break-all">Mã nộp: {entry.id}</small>
        <p role="status">{entry.state==='received'?(states[receipt?.status]||'Máy chủ đã nhận'):entry.state==='rejected'?'Cần sửa rồi nộp lại':'Đã lưu trên máy · chưa xác nhận máy chủ nhận'}</p>
        <small>{receipt?.message||entry.error}</small>
        {receipt?.received_at&&<small className="block">Máy chủ nhận lúc {new Date(receipt.received_at).toLocaleString('vi-VN')}</small>}
      </div>
      <div className="flex flex-wrap gap-2">
        {entry.payload?.source&&<button className="secondary-action" onClick={()=>downloadBackup(`bai-nop-${entry.id}.json`,entry)}>Tải dự phòng</button>}
        {entry.state!=='received'&&<button className="secondary-action" onClick={()=>outbox.retry(entry.id,user.id).catch(e=>setError(e.message))}>Thử gửi lại</button>}
        {entries.some(e=>e.id===entry.id)&&<button className="secondary-action" onClick={()=>{if(confirm('Xóa bản lưu trên thiết bị? Bài đã tới máy chủ vẫn được giữ.'))outbox.remove(entry.id,user.id).catch(e=>setError(e.message));}}>Xóa bản lưu</button>}
      </div>
    </article>;
  };

  return <section className="safety-panel mb-6" aria-label="Trạng thái bài nộp">
    <details onToggle={event=>setExpanded(event.currentTarget.open)}>
      <summary className="cursor-pointer font-bold text-base">Trạng thái bài nộp trên thiết bị · {active.length} cần chú ý · {completed.length} đã hoàn tất</summary>
      <div className="mt-4">
        <p>“Đã lưu trên máy” chưa phải “máy chủ đã nhận”. Giữ trình duyệt mở và nối mạng trước hạn nộp. Đổi tài khoản sẽ không gửi bài của tài khoản cũ.</p>
        {user&&<label className="block mt-3 text-sm">Khôi phục bản dự phòng (.json)<input type="file" accept=".json" className="block mt-2 max-w-full text-xs" onChange={async event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;try{if(file.size>3*1024*1024)throw new Error('Bản dự phòng quá lớn.');await outbox.restore(JSON.parse(await file.text()),user.id);setError('Đã khôi phục vào hàng chờ của tài khoản này.');}catch(error){setError(error.message);}}}/></label>}
        {error&&<p role="alert">{error}</p>}
        {active.length===0&&completed.length===0&&<p className="mt-3">Chưa có bài chờ gửi trên thiết bị.</p>}
        {active.length>0&&<div className="space-y-3 mt-3">{active.map(renderEntry)}</div>}
        {completed.length>0&&<details className="mt-4"><summary className="cursor-pointer font-semibold">Hiện {completed.length} bài đã hoàn tất</summary><div className="space-y-3 mt-3">{completed.map(renderEntry)}</div></details>}
        <p className="mt-3">Dùng cùng thiết bị và trình duyệt; không xóa dữ liệu trang web. Máy chấm gián đoạn sẽ giữ bài trên máy chủ và tự thử lại. Thời điểm nhận hợp lệ do máy chủ xác định.</p>
      </div>
    </details>
  </section>;
}
