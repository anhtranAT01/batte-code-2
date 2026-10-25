import {useEffect,useState} from 'react';

let state={offline:globalThis.navigator?.onLine===false};
const listeners=new Set();
let timer=null,controller=null;
const publish=value=>{state=value;listeners.forEach(listener=>listener(value));};
async function refresh(){
  controller?.abort();controller=new AbortController();
  if(!navigator.onLine){publish({offline:true});return;}
  const current=controller,timeout=setTimeout(()=>current.abort(),8000);
  try{const response=await fetch('/api/health',{signal:current.signal,cache:'no-store'});if(!response.ok)throw new Error('Health endpoint unavailable');const data=await response.json();if(controller===current)publish({...data,offline:false});}
  catch{if(controller===current)publish({offline:false,unreachable:true});}
  finally{clearTimeout(timeout);}
}
function subscribe(listener){
  listeners.add(listener);listener(state);
  if(listeners.size===1){refresh();timer=setInterval(refresh,30000);window.addEventListener('online',refresh);window.addEventListener('offline',refresh);}
  return()=>{listeners.delete(listener);if(!listeners.size){clearInterval(timer);timer=null;controller?.abort();window.removeEventListener('online',refresh);window.removeEventListener('offline',refresh);}};
}
export function useSystemStatus(){const [value,setValue]=useState(state);useEffect(()=>subscribe(setValue),[]);return value;}
