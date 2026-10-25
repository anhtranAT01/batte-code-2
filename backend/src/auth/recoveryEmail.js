const nodemailer = require('nodemailer');

const sender = () => process.env.EMAIL_FROM || process.env.SMTP_FROM;
function recoveryEmailEnabled(){
  if(!process.env.PASSWORD_RESET_URL||!sender())return false;
  try{const url=new URL(process.env.PASSWORD_RESET_URL);if(url.protocol!=='https:'&&!(process.env.NODE_ENV!=='production'&&url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))return false;}
  catch{return false;}
  return Boolean(process.env.RESEND_API_KEY||process.env.SMTP_HOST);
}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}

async function sendRecoveryEmail({to,url}){
  const from=sender();
  const subject='Khôi phục mật khẩu BattleCode';
  const text=`Bạn vừa yêu cầu khôi phục mật khẩu BattleCode. Mở liên kết dùng một lần trong 15 phút: ${url}\nNếu không yêu cầu, bạn có thể bỏ qua thư này.`;
  const html=`<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033;max-width:560px;margin:auto"><h2>Khôi phục mật khẩu BattleCode</h2><p>Bạn vừa yêu cầu đặt lại mật khẩu. Liên kết chỉ dùng một lần và hết hạn sau 15 phút.</p><p><a href="${escapeHtml(url)}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Đặt lại mật khẩu</a></p><p>Nếu nút không hoạt động, sao chép liên kết này vào trình duyệt:</p><p style="overflow-wrap:anywhere">${escapeHtml(url)}</p><p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p></div>`;

  if(process.env.RESEND_API_KEY){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject,text,html}),signal:controller.signal});
      if(!response.ok)throw new Error('Email provider rejected the request.');
      return await response.json();
    }finally{clearTimeout(timer);}
  }

  const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}:undefined,connectionTimeout:5000,socketTimeout:8000});
  try{return await transport.sendMail({from,to,subject,text,html});}
  finally{transport.close();}
}

module.exports={recoveryEmailEnabled,sendRecoveryEmail};
