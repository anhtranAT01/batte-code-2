import {deviceStore} from './deviceStore';
export function createOutbox({store=deviceStore,fetcher=(...args)=>fetch(...args),now=()=>Date.now(),uuid=()=>crypto.randomUUID(),notify=()=>{}}={}) {
  let running=false;
  async function enqueue(userId,kind,payload) {
    if(!userId)throw new Error('Hãy đăng nhập trước khi lưu bài chờ gửi.');
    const all=await store.list();
    // Tournament registrations are unique per account and tournament. Reuse the
    // durable submission id so repeated clicks/retries cannot create local rows.
    if(kind==='tournament'){
      const existing=all.find(x=>x.userId===userId&&x.kind==='tournament'&&x.payload?.tournamentId===payload?.tournamentId&&x.state!=='rejected');
      if(existing){
        if(existing.payload?.botId!==payload?.botId||existing.payload?.teamName!==payload?.teamName)throw new Error('Bạn đã có yêu cầu tham gia giải này trên thiết bị. Hãy mở Trạng thái hệ thống để kiểm tra trước khi đổi bot hoặc đội.');
        return existing;
      }
    }
    const entries=all.filter(x=>x.userId===userId&&x.state!=='received');
    if(entries.length>=20)throw new Error('Đã có 20 mục chờ trên máy. Hãy gửi hoặc tải dự phòng rồi xóa mục cũ.');
    const entry={id:uuid(),userId,kind,payload,createdAt:now(),state:'queued',attempts:0,nextAt:0};
    await store.put(entry);notify();return entry;
  }
  async function flush(session) {
    if(running||!session()?.token||globalThis.navigator?.onLine===false)return;
    running=true;
    try {
      const identity=session();
      const pending=(await store.list()).some(x=>x.userId===identity.userId&&x.state==='queued'&&x.nextAt<=now());
      // The global pump wakes periodically, but should make no network request
      // for accounts with an empty outbox.
      if(!pending)return;
      const timedFetch=async(url,init)=>{
        const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
        try{return await fetcher(url,{...init,signal:controller.signal});}finally{clearTimeout(timer);}
      };
      // Cached identity permits editing offline, but never authorizes sending for an account.
      const check=await timedFetch('/api/auth/me',{headers:{Authorization:`Bearer ${identity.token}`}});
      if(!check.ok)return;
      const profile=(await check.json()).data;
      if(profile?.id!==identity.userId)return;
      const entries=(await store.list()).filter(x=>x.userId===profile.id&&x.state==='queued'&&x.nextAt<=now()).sort((a,b)=>a.createdAt-b.createdAt);
      for(const entry of entries) {
        if(session()?.token!==identity.token||session()?.userId!==identity.userId)break;
        if(!(await store.list()).some(x=>x.id===entry.id))continue;
        try {
          const url=entry.kind==='bot'?'/api/support/submissions':entry.kind==='question'?'/api/support/questions':`/api/tournaments/${encodeURIComponent(entry.payload.tournamentId)}/register`;
          const body=entry.kind==='bot'?{id:entry.id,...entry.payload}:entry.kind==='question'?{id:entry.id,...entry.payload}:{botId:entry.payload.botId,teamName:entry.payload.teamName};
          const response=await timedFetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${identity.token}`},body:JSON.stringify(body)});
          if(response.status===401||response.status===403)break;
          let data={};try{data=await response.json();}catch{}
          if(response.ok){
            if(data.success!==true||(entry.kind!=='tournament'&&data.data?.id!==entry.id))throw new Error('Chưa nhận được biên nhận hợp lệ.');
            entry.state='received';entry.receipt=data.data||{message:data.message};entry.receivedAt=now();entry.error=null;
          }
          else if(response.status<500&&![408,425,429].includes(response.status)){entry.state='rejected';entry.error=data.message||`Máy chủ từ chối (${response.status}).`;}
          else throw new Error(data.message||'Máy chủ đang bận. Sẽ tự thử lại.');
        } catch(error) {
          entry.attempts++;entry.error='Chưa xác nhận máy chủ đã nhận. Sẽ tự gửi lại khi kết nối ổn định.';
          entry.nextAt=now()+Math.min(60000,2000*2**Math.min(entry.attempts,5));
        }
        await store.put(entry);notify();
      }
    } catch { /* Preserve all pending payloads when profile/network is unavailable. */ }
    finally{running=false;}
  }
  return {enqueue,flush,list:async userId=>(await store.list()).filter(x=>x.userId===userId),
    restore:async(entry,userId)=>{
      if(!entry||entry.userId!==userId||entry.kind!=='bot'||!/^[a-f0-9-]{36}$/i.test(entry.id)||typeof entry.payload?.name!=='string'||typeof entry.payload?.source!=='string'||entry.payload.source.length>2*1024*1024)throw new Error('Bản dự phòng không hợp lệ hoặc thuộc tài khoản khác.');
      if((await store.list()).some(x=>x.id===entry.id))throw new Error('Bài này đã có trên thiết bị.');
      await store.put({id:entry.id,userId,kind:'bot',payload:{name:entry.payload.name,source:entry.payload.source},createdAt:entry.createdAt||now(),state:'queued',attempts:0,nextAt:0});notify();
    },
    retry:async(id,userId)=>{const entry=(await store.list()).find(x=>x.id===id&&x.userId===userId);if(entry&&entry.state!=='received'){await store.put({...entry,state:'queued',nextAt:0});notify();}},
    remove:async(id,userId)=>{if((await store.list()).some(x=>x.id===id&&x.userId===userId)){await store.remove(id);notify();}}};
}
const listeners=new Set();
export const subscribeOutbox=listener=>{listeners.add(listener);return()=>listeners.delete(listener);};
export const outbox=createOutbox({notify:()=>listeners.forEach(fn=>fn())});
