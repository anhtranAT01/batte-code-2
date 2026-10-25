const assert = require('node:assert/strict');
const express = require('express');
// Exercise real HTTP streaming and worker execution without a live database.
require('../config/db').query = async () => ({rows:[]});
const executor = require('./duelExecutor');
const app = express();
app.use(express.json());
app.get('/ping',(req,res) => res.json({ok:true}));
app.use('/api/game',require('./gameRoutes'));
app.use((error,req,res,next) => res.status(error.statusCode || 500).json({message:error.message}));

async function main() {
  const server = app.listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const startedAt = performance.now(), events = [], streamedSteps = [];
    const response = await fetch(base+'/api/game/bot-vs-bot',{
      method:'POST',headers:{'Content-Type':'application/json',Accept:'application/x-ndjson'},
      body:JSON.stringify({bot1Id:'template_alphabeta',bot2Level:'HARD',boardSize:9,difficulty:'hard'}),
    });
    assert.equal(response.status,200);
    assert.match(response.headers.get('content-type'),/x-ndjson/);
    let pending='', firstBoardMs, pingMs, result;
    for await (const bytes of response.body) {
      pending += Buffer.from(bytes).toString('utf8');
      let newline;
      while ((newline=pending.indexOf('\n')) >= 0) {
        const event=JSON.parse(pending.slice(0,newline));
        pending=pending.slice(newline+1);
        events.push(event.type);
        if (event.type === 'started') {
          firstBoardMs=performance.now()-startedAt;
          assert.equal(event.data.replay.initialBoard.length,9);
          const pingStart=performance.now();
          assert.equal((await (await fetch(base+'/ping')).json()).ok,true);
          pingMs=performance.now()-pingStart;
        }
        if (event.type === 'steps') streamedSteps.push(...event.data.steps);
        if (event.type === 'error') throw Error(event.message);
        if (event.type === 'completed') result=event.data;
      }
    }
    assert.equal(events[0],'started');
    assert.ok(events.indexOf('steps') < events.indexOf('completed'));
    assert.ok(result.totalTurns > 0);
    assert.deepEqual(streamedSteps,result.replay.steps);
    assert.ok(pingMs < result.durationMs,'Other HTTP requests finish during CPU-heavy match computation');
    console.log(`PASS: real HTTP initial board ${firstBoardMs.toFixed(0)}ms, concurrent ping ${pingMs.toFixed(0)}ms, full computation ${result.durationMs}ms; streamed steps match saved replay`);

    const invalid=await fetch(base+'/api/game/bot-vs-bot',{
      method:'POST',headers:{'Content-Type':'application/json',Accept:'application/x-ndjson'},
      body:JSON.stringify({bot2Id:'cannot-pick-their-bot'}),
    });
    assert.equal(invalid.status,400);
    assert.match(invalid.headers.get('content-type'),/application\/json/);
    console.log('PASS: validation fails before opening a stream and retains the HTTP error status');
  } finally {
    await executor.shutdown();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => {console.error(error);process.exitCode=1;});
