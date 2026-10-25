const { parentPort } = require('node:worker_threads');
const { simulateDuel } = require('./duelSimulation');
let controller;
parentPort.on('message', async message => {
  if (message.type === 'cancel') { controller?.abort(); return; }
  if (message.type !== 'run') return;
  controller = new AbortController();
  try {
    const result = await simulateDuel(message.task, {
      signal:controller.signal,
      onProgress:event => parentPort.postMessage({ id:message.id, event }),
      onProcess:(pid,active) => parentPort.postMessage({id:message.id,process:{pid,active}}),
    });
    parentPort.postMessage({ id:message.id, result });
  } catch (error) {
    parentPort.postMessage({ id:message.id, error:{ message:error.message, statusCode:error.statusCode || 500 } });
  } finally { controller = null; }
});
