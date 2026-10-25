// NDJSON keeps initial board and actual moves visible before the match finishes.
// Clients without streaming support continue to receive the original JSON shape.
async function respondWithDuel(req,res,next,run) {
  const stream = req.get('accept')?.includes('application/x-ndjson');
  const controller = new AbortController();
  const abort = () => { if (!res.writableEnded) controller.abort(); };
  res.on('close',abort);
  let heartbeat;
  const send = event => {
    if (!stream || res.destroyed || res.writableEnded) return;
    if (!res.headersSent) {
      res.status(200).set({ 'Content-Type':'application/x-ndjson; charset=utf-8',
        'Cache-Control':'no-cache, no-transform', 'X-Accel-Buffering':'no' });
      res.flushHeaders();
      heartbeat = setInterval(() => { if (!res.destroyed) res.write('{"type":"heartbeat"}\n'); },10000);
      heartbeat.unref();
    }
    res.write(`${JSON.stringify(event)}\n`);
  };
  try {
    const result = await run({ signal:controller.signal, requestKey:req.user?.id || req.ip,
      onProgress:send });
    if (res.destroyed) return;
    if (stream) { send({type:'completed',data:result}); res.end(); }
    else res.json({success:true,data:result});
  } catch (error) {
    if (res.destroyed) return;
    if (res.headersSent) { send({type:'error',message:error.message}); res.end(); }
    else next(error);
  } finally {
    clearInterval(heartbeat);
    res.removeListener('close',abort);
  }
}
module.exports = { respondWithDuel };
