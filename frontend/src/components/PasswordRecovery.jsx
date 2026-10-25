import React,{useState} from 'react';
export default function PasswordRecovery({onBack}){
  const initial=new URLSearchParams(window.location.hash.slice(1)).get('reset_token')||new URLSearchParams(window.location.search).get('reset_token')||'';
  const [token]=useState(initial),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  return <form className="space-y-4" onSubmit={async event=>{
    event.preventDefault();setBusy(true);try{
      const res=await fetch('/api/auth/'+(token?'reset-password':'forgot-password'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(token?{token,password}:{email})});
      const data=await res.json();setMessage(data.message||'Chưa xử lý được yêu cầu.');
      if(res.ok&&token){const url=new URL(window.location.href);url.searchParams.delete('reset_token');url.hash='';window.history.replaceState({},'',url);}
    }catch{setMessage('Chưa kết nối được máy chủ.');}finally{setBusy(false);}
  }}><h2 className="font-bold">{token?'Đặt mật khẩu mới':'Khôi phục mật khẩu'}</h2>
    {token?<label className="block">Mật khẩu mới<input className="w-full mt-2 p-3 border rounded-xl" type="password" required minLength={6} maxLength={100} value={password} onChange={e=>setPassword(e.target.value)}/></label>:<label className="block">Email đã đăng ký<input className="w-full mt-2 p-3 border rounded-xl" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>}
    <p role="status" className="text-sm">{message}</p><button className="primary-action" disabled={busy}>{busy?'Đang xử lý…':token?'Lưu mật khẩu':'Gửi hướng dẫn'}</button><button type="button" className="secondary-action ml-2" onClick={onBack}>Về đăng nhập</button>
  </form>;
}
