import React,{lazy,Suspense,useEffect,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {readDraft} from '../lib/deviceStore';
import {useSystemStatus} from '../lib/systemHealth';
const DeviceSafety=lazy(()=>import('./DeviceSafety'));
const OfflineLab=lazy(()=>import('./OfflineLab'));
export default function SystemStatus({theme='dark',onToggleTheme}){
  const state=useSystemStatus();const {user,getAuthHeaders}=useAuth();const [message,setMessage]=useState(''),[offlineSource,setOfflineSource]=useState(''),[offlineOpen,setOfflineOpen]=useState(false);
  useEffect(()=>{let active=true;setOfflineSource('');if(!offlineOpen||!user)return;readDraft(user.id).then(async draft=>{if(!active)return;let source=draft?.codeContent||'';if(draft?.uploadMode==='file'&&draft?.selectedFile)source=await draft.selectedFile.text();if(active)setOfflineSource(source);}).catch(()=>{});return()=>{active=false;};},[offlineOpen,user?.id]);
  const labels={online:'Hoạt động',unavailable:'Gián đoạn',paused:'Tạm dừng'};
  const pause=async()=>{try{const res=await fetch('/api/support/judge',{method:'PATCH',headers:{...getAuthHeaders(),'Content-Type':'application/json'},body:JSON.stringify({paused:state.judge!=='paused'})});if(!res.ok)throw new Error();setMessage('Đã cập nhật. Trạng thái sẽ làm mới trong 30 giây.');}catch{setMessage('Chưa cập nhật được máy chấm.');}};
  return <div className="max-w-7xl mx-auto">
    <section className="safety-panel mb-6" aria-label="Trạng thái hệ thống">
    <h2>Trạng thái hệ thống</h2><p>{state.offline?'Bạn đang mất mạng. Bản lưu trên máy chưa được xác nhận đã nộp.':state.unreachable?'Chưa liên lạc được máy chủ. Bài chờ gửi vẫn được giữ trên thiết bị.':`Kiểm tra lúc ${state.timestamp?new Date(state.timestamp).toLocaleTimeString('vi-VN'):'…'} · tự cập nhật mỗi 30 giây`}</p>
    <div className="space-y-2 mt-4">{[['gateway','Máy chủ trung tâm'],['database','Cơ sở dữ liệu'],['judge','Máy chấm nhận bài Python'],['tournamentJudge','Máy chấm giải đấu (Redis / worker)']].map(([key,name])=><div key={key} className="safety-row"><strong>{name}</strong><span className={`health-badge ${state[key]==='online'?'is-ok':''}`}>{state.offline?'Ngoại tuyến':labels[state[key]]||'Chưa xác định'}</span></div>)}</div>
    <div className="safety-row mt-4"><div><strong>Giao diện</strong><p className="text-sm mt-1">Hiện tại: {theme==='dark'?'Tối':'Sáng'}</p></div><button type="button" className="secondary-action" onClick={onToggleTheme} aria-label={theme==='dark'?'Chuyển sang giao diện sáng':'Chuyển sang giao diện tối'}>Chuyển sang {theme==='dark'?'sáng':'tối'}</button></div>
    <p className="mt-4">Nếu máy chấm lỗi, bài đã nhận được giữ trong cơ sở dữ liệu và tự thử lại. Admin có thể tạm dừng kiểm tra bài để xử lý sự cố; bài mới vẫn được tiếp nhận.</p>
    {user?.role==='ADMIN'&&<button className="secondary-action mt-3" onClick={pause}>{state.judge==='paused'?'Tiếp tục kiểm tra bài':'Tạm dừng kiểm tra bài'}</button>}{message&&<p role="status">{message}</p>}
    <details className="mt-4"><summary className="cursor-pointer font-semibold">Mất mạng, mất điện và bản dự phòng</summary><div className="space-y-2 mt-3"><p>Mã và file đang soạn được lưu tự động trên thiết bị. Mất điện ngay lúc gõ có thể làm mất phần chưa kịp lưu. Nên tải mã nguồn hoặc bản dự phòng trước khi rời máy.</p><p>Hàng chờ tự gửi lại khi mở trang và có mạng. Trình duyệt đã đóng sẽ không tự gửi nền. Hạn đăng ký được xét theo thời điểm máy chủ nhận, không theo giờ lưu trên máy.</p><p>Hãy tải gói ngoại tuyến tại trang Hỗ trợ khi còn mạng. Đấu thử trên máy không tính điểm và không thay thế bài nộp chính thức.</p></div></details>
    </section>
    <Suspense fallback={<div role="status" className="py-4 text-sm text-slate-400">Đang mở công cụ hỗ trợ…</div>}><DeviceSafety /></Suspense>
    <details className="safety-panel mb-6" onToggle={event=>setOfflineOpen(event.currentTarget.open)}><summary className="cursor-pointer font-bold">Phòng thử bot ngoại tuyến</summary>{offlineOpen&&<div className="mt-4"><Suspense fallback={<div role="status" className="py-4 text-sm text-slate-400">Đang mở phòng thử…</div>}><OfflineLab source={offlineSource} /></Suspense></div>}</details>
  </div>;
}
