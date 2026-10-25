const path = require('node:path');
const { Worker } = require('node:worker_threads');
const { killProcessTree } = require('./pythonRunner');

const failure = (message,statusCode) => Object.assign(new Error(message), { statusCode });
const bounded = (value,fallback,max) => Math.max(1,Math.min(max,Number.parseInt(value,10) || fallback));

function createDuelExecutor({
  concurrency = bounded(process.env.DUEL_WORKERS,1,4),
  queueLimit = bounded(process.env.DUEL_QUEUE_LIMIT,16,100),
  timeoutMs = bounded(process.env.DUEL_TIMEOUT_MS,60000,180000),
  workerPath = path.join(__dirname,'duelWorker.js'),
} = {}) {
  const slots = new Set(), queue = [], owners = new Set();
  let serial = 0, closed = false;
  function settle(slot,error,result) {
    const job = slot.job;
    if (!job) return;
    slot.job = null;
    clearTimeout(job.timer);
    job.signal?.removeEventListener('abort',job.abort);
    if (job.owner) owners.delete(job.owner);
    if (error) job.reject(error); else job.resolve(result);
    slot.worker.unref();
    pump();
  }
  function discard(slot,error) {
    slots.delete(slot);
    for (const pid of slot.pids.keys()) killProcessTree(pid);
    slot.pids.clear();
    slot.worker.terminate();
    settle(slot,error);
  }
  function makeSlot() {
    const worker = new Worker(workerPath);
    const slot = { worker, job:null, pids:new Map() };
    slots.add(slot);
    worker.on('message',message => {
      // A killed Python process may close after its job has settled or the
      // worker has started another match. Never retain a stale, recyclable PID.
      if (message.process && !message.process.active) {
        if (slot.pids.get(message.process.pid) === message.id) slot.pids.delete(message.process.pid);
        return;
      }
      if (slot.job?.id !== message.id) return;
      if (message.process) {
        slot.pids.set(message.process.pid,message.id);
        return;
      }
      if (message.event) {
        try { slot.job.onProgress?.(message.event); }
        catch (error) { discard(slot,error); }
        return;
      }
      settle(slot,message.error ? failure(message.error.message,message.error.statusCode) : null,message.result);
    });
    worker.on('error',error => discard(slot,error));
    worker.on('exit',code => {
      if (!slots.has(slot)) return;
      slots.delete(slot);
      for (const pid of slot.pids.keys()) killProcessTree(pid);
      settle(slot,failure(`Tiến trình tính trận dừng (${code}). Vui lòng thử lại.`,503));
    });
    worker.unref();
    return slot;
  }
  function pump() {
    if (closed) return;
    while (queue.length) {
      let slot = [...slots].find(entry => !entry.job);
      if (!slot && slots.size < concurrency) slot = makeSlot();
      if (!slot) break;
      const job = queue.shift();
      slot.job = job;
      job.slot = slot;
      job.timer = setTimeout(() => {
        slot.worker.postMessage({ type:'cancel' });
        discard(slot,failure('Trận đấu vượt thời gian xử lý. Hãy thử lại hoặc kiểm tra bot.',408));
      },timeoutMs);
      slot.worker.ref();
      slot.worker.postMessage({ type:'run',id:job.id,task:job.task });
    }
  }
  function run(task,{onProgress,signal,owner} = {}) {
    if (closed) return Promise.reject(failure('Máy chủ đang khởi động lại.',503));
    if (signal?.aborted) return Promise.reject(failure('Trận đấu đã dừng.',499));
    if (owner && owners.has(owner)) return Promise.reject(failure('Bạn đang có một trận chạy. Hãy chờ trận đó hoàn tất.',409));
    if (queue.length >= queueLimit) return Promise.reject(failure('Máy chủ đang đủ trận. Vui lòng thử lại sau ít giây.',429));
    return new Promise((resolve,reject) => {
      const job = { id:++serial,task,onProgress,signal,owner,resolve,reject };
      if (owner) owners.add(owner);
      job.abort = () => {
        if (job.slot) {
          // Python receives cancellation first so its process tree can be killed.
          job.slot.worker.postMessage({ type:'cancel' });
          const slot = job.slot;
          setTimeout(() => { if (slot.job === job) discard(slot,failure('Trận đấu đã dừng.',499)); },100).unref();
        } else {
          const index = queue.indexOf(job);
          if (index >= 0) queue.splice(index,1);
          if (owner) owners.delete(owner);
          signal?.removeEventListener('abort',job.abort);
          reject(failure('Trận đấu đã dừng.',499));
        }
      };
      signal?.addEventListener('abort',job.abort,{once:true});
      queue.push(job);
      if (![...slots].some(slot => !slot.job) && slots.size >= concurrency) {
        try { onProgress?.({ type:'queued', data:{ position:queue.length } }); }
        catch (error) {
          queue.splice(queue.indexOf(job),1);
          if (owner) owners.delete(owner);
          signal?.removeEventListener('abort',job.abort);
          reject(error);
          return;
        }
      }
      pump();
    });
  }
  async function shutdown() {
    closed = true;
    for (const job of queue.splice(0)) {
      job.signal?.removeEventListener('abort',job.abort);
      job.reject(failure('Máy chủ đang khởi động lại.',503));
    }
    owners.clear();
    await Promise.all([...slots].map(slot => {
      for (const pid of slot.pids.keys()) killProcessTree(pid);
      settle(slot,failure('Máy chủ đang khởi động lại.',503));
      slots.delete(slot);
      return slot.worker.terminate();
    }));
  }
  return { run,shutdown };
}

const executor = createDuelExecutor();
module.exports = { ...executor, createDuelExecutor };
