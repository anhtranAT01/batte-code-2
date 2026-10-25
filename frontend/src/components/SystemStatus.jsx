import React,{useEffect,useState} from 'react';
import {useAuth} from '../context/AuthContext';
export function useSystemStatus(){
  const [state,setState]=useState({offline:globalThis.navigator?.onLine===false});
  useEffect(()=>{
    let alive=true,controller;
    const refresh=async()=>{
      controller?.abort();controller=new AbortController();
      if(!navigator.onLine){setState({offline:true});return;}
      const timeout=setTimeout(()=>controller.abort(),8000);
      try{const res=await fetch('/api/health',{signal:controller.signal,cache:'no-store'});const data=await res.json();if(alive)setState({...data,offline:false});}
      catch{if(alive)setState({offline:false,unreachable:true});}finally{clearTimeout(timeout);}
    };
    refresh();const timer=setInterval(refresh,30000);window.addEventListener('online',refresh);window.addEventListener('offline',refresh);
    return()=>{alive=false;controller?.abort();clearInterval(timer);window.removeEventListener('online',refresh);window.removeEventListener('offline',refresh);};
  },[]);return state;
}
export default function SystemStatus(){
  const state=useSystemStatus();const {user,getAuthHeaders}=useAuth();const [message,setMessage]=useState('');
  const labels={online:'Hoạt động',unavailable:'Gián đoạn',paused:'Tạm dừng'};
  const pause=async()=>{try{const res=await fetch('/api/support/judge',{method:'PATCH',headers:{...getAuthHeaders(),'Content-Type':'application/json'},body:JSON.stringify({paused:state.judge!=='paused'})});if(!res.ok)throw new Error();setMessage('Đã cập nhật. Trạng thái sẽ làm mới trong 30 giây.');}catch{setMessage('Chưa cập nhật được máy chấm.');}};
  return <section className="safety-panel mb-6" aria-label="Trạng thái hệ thống">
    <h2>Trạng thái hệ thống</h2><p>{state.offline?'Bạn đang mất mạng. Bản lưu trên máy chưa được xác nhận đã nộp.':state.unreachable?'Chưa liên lạc được máy chủ. Bài chờ gửi vẫn được giữ trên thiết bị.':`Kiểm tra lúc ${state.timestamp?new Date(state.timestamp).toLocaleTimeString('vi-VN'):'…'} · tự cập nhật mỗi 30 giây`}</p>
    <div className="space-y-2 mt-4">{[['gateway','Máy chủ trung tâm'],['database','Cơ sở dữ liệu'],['judge','Máy chấm nhận bài Python'],['tournamentJudge','Máy chấm giải đấu (Redis / worker)']].map(([key,name])=><div key={key} className="safety-row"><strong>{name}</strong><span className={`health-badge ${state[key]==='online'?'is-ok':''}`}>{state.offline?'Ngoại tuyến':labels[state[key]]||'Chưa xác định'}</span></div>)}</div>
    <p className="mt-4">Nếu máy chấm lỗi, bài đã nhận được giữ trong cơ sở dữ liệu và tự thử lại. Admin có thể tạm dừng kiểm tra bài để xử lý sự cố; bài mới vẫn được tiếp nhận.</p>
    {user?.role==='ADMIN'&&<button className="secondary-action mt-3" onClick={pause}>{state.judge==='paused'?'Tiếp tục kiểm tra bài':'Tạm dừng kiểm tra bài'}</button>}{message&&<p role="status">{message}</p>}
    <details className="mt-4"><summary className="cursor-pointer font-semibold">Mất mạng, mất điện và bản dự phòng</summary><div className="space-y-2 mt-3"><p>Mã và file đang soạn được lưu tự động trên thiết bị. Mất điện ngay lúc gõ có thể làm mất phần chưa kịp lưu. Nên tải mã nguồn hoặc bản dự phòng trước khi rời máy.</p><p>Hàng chờ tự gửi lại khi mở trang và có mạng. Trình duyệt đã đóng sẽ không tự gửi nền. Hạn đăng ký được xét theo thời điểm máy chủ nhận, không theo giờ lưu trên máy.</p><p>Gói ngoại tuyến trong Kho bot phải được tải khi còn mạng. Đấu thử trên máy không tính điểm và không thay thế bài nộp chính thức.</p></div></details>
  </section>;
}
