// Short-lived memory snapshots for navigation. Private bot lists are keyed by
// authorization; no account data or credentials are written to browser storage.
const paths=new Set(['/api/bots/players','/api/bots/my-bots','/api/bots/templates','/api/tournaments','/api/tournaments/teams']);
const cache=new Map(),pending=new Map();
let generation=0;
const keyFor=(path,headers)=>`${path}\n${new Headers(headers).get('Authorization') || ''}`;
const ttl=path=>path==='/api/bots/templates'?300_000:5000;
export function invalidateScreenData(){generation++;cache.clear();pending.clear();}
export function peekScreenData(path,headers={}){
  const entry=cache.get(keyFor(path,headers));
  return entry && Date.now()-entry.at<Math.max(ttl(path),60_000)?entry.data:undefined;
}
function subscribe(request,signal){
  if(!signal)return request;
  if(signal.aborted)return Promise.reject(new DOMException('Aborted','AbortError'));
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(new DOMException('Aborted','AbortError'));
    signal.addEventListener('abort',abort,{once:true});
    request.then(value=>{if(!signal.aborted)resolve(value);},reject).finally(()=>signal.removeEventListener('abort',abort));
  });
}
export function readScreenData(path,{headers={},force=false,signal,timeoutMs=10_000}={}){
  if(!paths.has(path))return Promise.reject(new Error('Unsupported navigation read'));
  if(signal?.aborted)return Promise.reject(new DOMException('Aborted','AbortError'));
  const key=keyFor(path,headers),entry=cache.get(key);
  if(!force && entry && Date.now()-entry.at<ttl(path))return Promise.resolve(entry.data);
  if(!force && pending.has(key))return subscribe(pending.get(key),signal);
  const version=generation,controller=new AbortController();let timer;
  const timeout=new Promise((resolve,reject)=>{timer=setTimeout(()=>{
    controller.abort();reject(new Error('Máy chủ phản hồi chậm. Vui lòng thử lại.'));
  },timeoutMs);});
  const request=Promise.race([(async()=>{
    const response=await fetch(path,{headers,signal:controller.signal,cache:'no-store'});
    const result=await response.json();
    if(!response.ok || result.success===false)throw new Error(result.message || 'Không tải được dữ liệu.');
    const data=result.data || [];
    if(!controller.signal.aborted && generation===version && pending.get(key)===request){
      cache.delete(key);cache.set(key,{data,at:Date.now()});
      if(cache.size>40)cache.delete(cache.keys().next().value);
    }
    return data;
  })(),timeout]).finally(()=>{clearTimeout(timer);if(pending.get(key)===request)pending.delete(key);});
  pending.set(key,request);return subscribe(request,signal);
}
export function prefetchScreenData(tab,headers={}){
  const list={pvp:['/api/bots/players'],boss:['/api/bots/my-bots'],bots:['/api/bots/my-bots','/api/bots/templates'],tournament:['/api/tournaments','/api/bots/my-bots']};
  for(const path of list[tab] || []){
    if(path.endsWith('/my-bots') && !new Headers(headers).has('Authorization'))continue;
    readScreenData(path,{headers:path.endsWith('/my-bots')?headers:{}}).catch(()=>{});
  }
}
