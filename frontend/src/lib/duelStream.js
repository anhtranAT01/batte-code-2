export async function runDuel(path,{body,headers,signal,onUpdate}) {
  const response = await fetch(path, {method:'POST',signal,
    headers:{'Content-Type':'application/json',...headers,Accept:'application/x-ndjson'},
    body:JSON.stringify(body)});
  if (!response.ok || !response.headers?.get('content-type')?.includes('application/x-ndjson')) {
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Không thể tạo trận đấu.');
    return result.data;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '', result;
  try {
    while (true) {
      const {value,done} = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value,{stream:true});
      let newline;
      while ((newline = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0,newline).trim();
        pending = pending.slice(newline+1);
        if (!line) continue;
        const event = JSON.parse(line);
        if (event.type === 'error') throw new Error(event.message || 'Bot không thể tiếp tục trận.');
        if (event.type === 'completed') result = event.data;
        else if (event.type !== 'heartbeat') onUpdate?.(event);
      }
      if (done) break;
    }
    if (!result) throw new Error('Kết nối trận đấu bị gián đoạn. Hãy thử lại.');
    return result;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function applyDuelEvent(current,event) {
  if (event.type === 'started') return {...event.data,replay:{...event.data.replay,steps:[]}};
  if (event.type === 'steps' && current) return {...current,totalTurns:event.data.totalTurns,
    replay:{...current.replay,steps:[...current.replay.steps,...event.data.steps]}};
  return current;
}
