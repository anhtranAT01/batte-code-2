import React,{useEffect,useRef,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {outbox,subscribeOutbox} from '../lib/outbox';
export function OutboxPump(){
  const {user,token}=useAuth();const session=useRef();session.current={userId:user?.id,token};
  useEffect(()=>{
    const flush=()=>outbox.flush(()=>session.current);
    flush();const interval=setInterval(flush,10000);
    const unsubscribe=subscribeOutbox(flush);
    window.addEventListener('online',flush);document.addEventListener('visibilitychange',flush);
    return()=>{clearInterval(interval);unsubscribe();window.removeEventListener('online',flush);document.removeEventListener('visibilitychange',flush);};
  },[user?.id,token]);return null;
}
export function downloadBackup(filename,data){
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function DeviceSafety({onAccepted}){
  const {user,getAuthHeaders}=useAuth();const [entries,setEntries]=useState([]);const [receipts,setReceipts]=useState([]);const [error,setError]=useState('');
  const [receiptOwner,setReceiptOwner]=useState(null);
  const accepted=useRef(''),callback=useRef(onAccepted);callback.current=onAccepted;
  useEffect(()=>{const key=receipts.filter(r=>r.status==='accepted').map(r=>r.id).sort().join(',');if(key&&key!==accepted.current)callback.current?.();accepted.current=key;},[receipts]);
  useEffect(()=>{
    let active=true;
    const refresh=async()=>{try{const list=user?await outbox.list(user.id):[];if(active)setEntries(list);}catch{if(active)setError('Kho lưu thiết bị không khả dụng. Hãy tải bản dự phòng trước khi rời trang.');}};
    const server=async()=>{if(!user)return;try{const res=await fetch('/api/support/submissions',{headers:getAuthHeaders()});if(res.ok){const data=await res.json();if(active){setReceipts(data.data||[]);setReceiptOwner(user.id);}}}catch{}};
    setReceipts([]);refresh();server();const unsubscribe=subscribeOutbox(()=>{refresh();server();});
    const timer=setInterval(server,10000);return()=>{active=false;unsubscribe();clearInterval(timer);};
  },[user?.id]);
  const states={pending:'Máy chủ đã nhận · chờ máy chấm',processing:'Máy chủ đang kiểm tra',accepted:'Đã kiểm tra · có trong Kho bot',rejected:'Máy chủ từ chối'};
  const visibleReceipts=receiptOwner===user?.id?receipts:[];
  const merged=[...entries.filter(entry=>entry.userId===user?.id),...visibleReceipts.filter(r=>!entries.some(e=>e.id===r.id)).map(r=>({id:r.id,payload:{name:r.name},state:'received',receipt:r}))];
  return <section className="safety-panel my-5" aria-label="Trạng thái bài nộp">
    <h2>Trạng thái bài nộp trên thiết bị</h2>
    <p>“Đã lưu trên máy” chưa phải “máy chủ đã nhận”. Giữ trình duyệt mở và nối mạng trước hạn nộp. Đổi tài khoản sẽ không gửi bài của tài khoản cũ.</p>
    {user&&<label className="block mt-3 text-sm">Khôi phục bản dự phòng (.json)<input type="file" accept=".json" className="block mt-2 max-w-full text-xs" onChange={async event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;try{if(file.size>3*1024*1024)throw new Error('Bản dự phòng quá lớn.');await outbox.restore(JSON.parse(await file.text()),user.id);setError('Đã khôi phục vào hàng chờ của tài khoản này.');}catch(error){setError(error.message);}}}/></label>}
    {error&&<p role="alert">{error}</p>}
    {!merged.length&&<p>Chưa có bài chờ gửi trên thiết bị này.</p>}
    <div className="space-y-3 mt-3">{merged.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).map(entry=>{
      const receipt=visibleReceipts.find(r=>r.id===entry.id)||entry.receipt;
      return <article key={entry.id} className="safety-row">
        <div className="min-w-0"><strong>{entry.payload.name|| (entry.kind==='question'?'Câu hỏi gửi BTC':'Đăng ký giải đấu')}</strong>
          <small className="block break-all">Mã nộp: {entry.id}</small>
          <p role="status">{entry.state==='received'?(states[receipt?.status]||'Máy chủ đã nhận'):entry.state==='rejected'?'Cần sửa rồi nộp lại':'Đã lưu trên máy · chưa xác nhận máy chủ nhận'}</p>
          <small>{receipt?.message||entry.error}</small>
          {receipt?.received_at&&<small className="block">Máy chủ nhận lúc {new Date(receipt.received_at).toLocaleString('vi-VN')}</small>}
        </div>
        <div className="flex flex-wrap gap-2">
          {entry.payload.source&&<button className="secondary-action" onClick={()=>downloadBackup(`bai-nop-${entry.id}.json`,entry)}>Tải dự phòng</button>}
          {entry.state!=='received'&&<button className="secondary-action" onClick={()=>outbox.retry(entry.id,user.id).catch(e=>setError(e.message))}>Thử gửi lại</button>}
          {entries.some(e=>e.id===entry.id)&&<button className="secondary-action" onClick={()=>{if(confirm('Xóa bản lưu trên thiết bị? Bài đã tới máy chủ vẫn được giữ.'))outbox.remove(entry.id,user.id).catch(e=>setError(e.message));}}>Xóa bản lưu</button>}
        </div>
      </article>;
    })}</div>
    <p className="mt-3">Dùng cùng thiết bị và trình duyệt; không xóa dữ liệu trang web. Máy chấm gián đoạn sẽ giữ bài trên máy chủ và tự thử lại. Thời điểm nhận hợp lệ do máy chủ xác định.</p>
  </section>;
}
