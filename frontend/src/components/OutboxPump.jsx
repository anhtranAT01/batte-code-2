import {useEffect} from 'react';
import {useAuth} from '../context/AuthContext';
import {outbox,subscribeOutbox} from '../lib/outbox';

export default function OutboxPump(){
  const {user,token}=useAuth();
  useEffect(()=>{
    const flush=()=>outbox.flush(()=>({userId:user?.id,token}));
    flush();const interval=setInterval(flush,10000);
    const unsubscribe=subscribeOutbox(flush);
    window.addEventListener('online',flush);document.addEventListener('visibilitychange',flush);
    return()=>{clearInterval(interval);unsubscribe();window.removeEventListener('online',flush);document.removeEventListener('visibilitychange',flush);};
  },[user?.id,token]);return null;
}
