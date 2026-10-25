const { parentPort } = require('node:worker_threads');
let active;
parentPort.on('message', message => {
  if (message.type === 'cancel') {
    if (active && active.task.mode !== 'ignore-cancel') {
      clearTimeout(active.timer);
      parentPort.postMessage({ id: active.id, error: { message: 'cancelled', statusCode: 499 } });
      active = null;
    }
    return;
  }
  if (message.type !== 'run') return;
  const { id, task } = message;
  if (task.mode === 'crash') return process.exit(17);
  if (task.mode === 'late-process-close') {
    // No real OS process is involved: the executor test spies on cleanup calls.
    parentPort.postMessage({ id, process: { pid: 123456789, active: true } });
    parentPort.postMessage({ id, result: { ok: true } });
    setTimeout(() => parentPort.postMessage({ id, process: { pid: 123456789, active: false } }), 20);
    return;
  }
  active = { id, task };
  if (task.mode === 'tracked-process') {
    parentPort.postMessage({ id, process: { pid: 123456789, active: true } });
  }
  parentPort.postMessage({ id, event: { type: 'started' } });
  active.timer = setTimeout(() => {
    parentPort.postMessage({ id, result: { ok: true, label: task.label } });
    active = null;
  }, task.delay || 0);
});
