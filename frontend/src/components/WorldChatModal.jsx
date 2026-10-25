import React,{useEffect,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {outbox} from '../lib/outbox';
import DeviceSafety from './DeviceSafety';
export default function WorldChatModal({isOpen,onClose,onLogin}){
  const {user,getAuthHeaders}=useAuth();const staff=['ADMIN','TEACHER'].includes(user?.role);
  const [items,setItems]=useState([]),[publicItems,setPublicItems]=useState([]),[text,setText]=useState(''),[category,setCategory]=useState('technical'),[message,setMessage]=useState(''),[loading,setLoading]=useState(false),[answers,setAnswers]=useState({}),[publish,setPublish]=useState({});
  const refresh=async()=>{
    try{
      const res=await fetch(user?'/api/support/questions':'/api/support/questions/public',{headers:user?getAuthHeaders():{}});
      const data=await res.json();if(!res.ok)throw new Error(data.message||'Chưa tải được câu hỏi.');
      if(user)setItems(data.data||[]);else setPublicItems(data.data||[]);
      if(user){const publicRes=await fetch('/api/support/questions/public');if(publicRes.ok)setPublicItems((await publicRes.json()).data||[]);}
    }catch{setMessage('Chưa kết nối được máy chủ. Nội dung đang nhập vẫn được giữ.');}
  };
  useEffect(()=>{setItems([]);setText('');setAnswers({});setPublish({});if(!isOpen)return;refresh();const timer=setInterval(refresh,30000);return()=>clearInterval(timer);},[isOpen,user?.id]);
  if(!isOpen)return null;
  const send=async(event)=>{event.preventDefault();setLoading(true);try{await outbox.enqueue(user.id,'question',{category,question:text.trim()});setText('');setMessage('Đã lưu câu hỏi trên thiết bị. Hệ thống tự gửi tới Admin / Giáo viên khi có kết nối.');}catch(error){setMessage(error.message);}finally{setLoading(false);}};
  const answer=async item=>{
    setLoading(true);try{
      const res=await fetch(`/api/support/questions/${item.id}`,{method:'PATCH',headers:{...getAuthHeaders(),'Content-Type':'application/json'},body:JSON.stringify({answer:answers[item.id]??item.answer??'',isPublic:publish[item.id]??item.is_public})});
      if(!res.ok)throw new Error((await res.json()).message||'Chưa lưu được câu trả lời.');
      setMessage('Đã lưu câu trả lời.');await refresh();
    }catch(error){setMessage(error.message);}finally{setLoading(false);}
  };
  return <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="Hỏi đáp với Ban tổ chức">
    <div className="modal-card w-full max-w-4xl max-h-[92vh] overflow-y-auto p-5 sm:p-7">
      <div className="flex justify-between gap-4"><div><h1 className="text-xl font-bold">Hỏi đáp với Admin & Giáo viên</h1><p className="text-sm mt-2">Hỏi về luật, kỹ thuật, lịch thi hoặc báo sự cố. Câu hỏi riêng chỉ bạn và Ban tổ chức xem được.</p></div><button className="secondary-action self-start" onClick={onClose} aria-label="Đóng hỏi đáp">Đóng</button></div>
      <p className="text-sm mt-2">Câu trả lời chung do Ban tổ chức công khai sẽ ẩn danh người gửi. Không đưa mật khẩu hoặc thông tin riêng vào câu hỏi.</p>
      {message&&<p className="safety-panel my-4" role="status">{message}</p>}
      {!user?<div className="safety-panel my-5 text-center"><h2>Đăng nhập để gửi câu hỏi</h2><button className="primary-action mt-4" onClick={onLogin}>Đăng nhập</button></div>:<>
        {!staff&&<form className="safety-panel my-5 space-y-3" onSubmit={send}>
          <label className="block">Chủ đề<select className="w-full mt-2 p-2 rounded-lg border" value={category} onChange={e=>setCategory(e.target.value)}><option value="rules">Luật thi đấu</option><option value="technical">Kỹ thuật / nộp bot</option><option value="schedule">Lịch thi</option><option value="incident">Báo sự cố</option></select></label>
          <label className="block">Câu hỏi<textarea className="w-full mt-2 p-3 rounded-lg border" rows={4} minLength={5} maxLength={4000} required value={text} onChange={e=>setText(e.target.value)}/></label>
          <button className="primary-action" disabled={loading}>Gửi đến Admin / Giáo viên</button>
        </form>}
        <DeviceSafety />
        <div className="flex justify-between items-center mt-6"><h2 className="font-bold">{staff?'Hộp thư Ban tổ chức':'Câu hỏi của bạn'}</h2><button className="secondary-action" onClick={refresh}>Làm mới</button></div>
        {!items.length&&<p className="my-4">Chưa có câu hỏi trên máy chủ.</p>}
        {items.filter(item=>staff||item.user_id===user.id).map(item=><article className="safety-panel my-3" key={item.id}>
          <small>{staff?`${item.username} · `:''}{new Date(item.created_at).toLocaleString('vi-VN')} · {item.answer?'Đã trả lời':'Chờ phản hồi'}</small>
          <p className="whitespace-pre-wrap my-3 font-semibold">{item.question}</p>
          {staff?<div className="space-y-3"><label className="block">Câu trả lời<textarea className="w-full mt-2 p-3 rounded-lg border" rows={3} maxLength={8000} value={answers[item.id]??item.answer??''} onChange={e=>setAnswers({...answers,[item.id]:e.target.value})}/></label>
            <label className="flex items-start gap-2"><input type="checkbox" checked={publish[item.id]??item.is_public} onChange={e=>setPublish({...publish,[item.id]:e.target.checked})}/><span>Công khai ẩn danh. Kiểm tra và loại bỏ thông tin cá nhân trong nội dung trước khi công khai.</span></label>
            <button className="primary-action" disabled={loading||!(answers[item.id]??item.answer??'').trim()} onClick={()=>answer(item)}>Lưu trả lời</button>
          </div>:<p className="whitespace-pre-wrap">{item.answer||'Ban tổ chức sẽ trả lời tại đây.'}</p>}
        </article>)}
      </>}
      <h2 className="font-bold mt-6">Hỏi đáp chung · ẩn danh</h2>
      {publicItems.map(item=><details className="safety-panel my-3" key={item.id}><summary className="cursor-pointer font-semibold">{item.question}</summary><p className="whitespace-pre-wrap mt-3">{item.answer}</p></details>)}
      {!publicItems.length&&<p className="my-4">Chưa có câu trả lời công khai.</p>}
    </div>
  </div>;
}
