const assert = require('node:assert/strict');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { spawnSync } = require('node:child_process');
const python = require('./pythonRunner');
const cleanupCalls = [];
// Spy only on executor cleanup. Runner tests below use its private real killer.
const kill = python.killProcessTree;
python.killProcessTree = pid => cleanupCalls.push(pid);
const { createDuelExecutor } = require('./duelExecutor');
python.killProcessTree = kill;
const { GameEngine } = require('./gameEngine');
const { getPracticeBot } = require('./practiceBots');
const fixturePath = path.join(__dirname, 'fixtures/duelWorkerFixture.js');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const status = code => error => error.statusCode === code;
function fixture(options = {}) {
  return createDuelExecutor({ concurrency: 1, queueLimit: 1, timeoutMs: 1000,
    workerPath: fixturePath, ...options });
}

async function lifecycle() {
  let executor = fixture();
  try {
    const first = executor.run({ delay: 120, label: 'first' }, { owner: 'one' });
    let queuePosition;
    const queued = executor.run({ label: 'second' }, { owner: 'two',
      onProgress: event => { if (event.type === 'queued') queuePosition = event.data.position; } });
    await assert.rejects(executor.run({}, { owner: 'one' }), status(409));
    await assert.rejects(executor.run({}, { owner: 'three' }), status(429));
    assert.equal((await first).label, 'first');
    assert.equal((await queued).label, 'second');
    assert.equal(queuePosition, 1);
    assert.ok((await executor.run({}, { owner: 'one' })).ok);
    const aborted = new AbortController();
    aborted.abort();
    await assert.rejects(executor.run({}, { signal: aborted.signal }), status(499));
  } finally { await executor.shutdown(); }

  executor = fixture();
  try {
    const first = executor.run({ delay: 80 });
    const controller = new AbortController();
    const queued = executor.run({}, { owner: 'queued', signal: controller.signal });
    controller.abort();
    await assert.rejects(queued, status(499));
    const replacement = executor.run({}, { owner: 'queued' });
    await Promise.all([first, replacement]);
    const blocking = executor.run({ delay: 80 });
    await assert.rejects(executor.run({}, { owner: 'callback',
      onProgress: event => { if (event.type === 'queued') throw new Error('queue callback failed'); } }), /queue callback failed/);
    await Promise.all([blocking, executor.run({}, { owner: 'callback' })]);
    const running = new AbortController();
    await assert.rejects(executor.run({ delay: 800 }, { signal: running.signal,
      onProgress: event => { if (event.type === 'started') running.abort(); } }), status(499));
    assert.ok((await executor.run({})).ok);
    await assert.rejects(executor.run({}, { onProgress: () => { throw new Error('progress callback failed'); } }), /progress callback failed/);
    assert.ok((await executor.run({})).ok);
  } finally { await executor.shutdown(); }

  executor = fixture({ timeoutMs: 200 });
  try {
    await assert.rejects(executor.run({ mode: 'ignore-cancel', delay: 1000 }), status(408));
    assert.ok((await executor.run({})).ok);
    await assert.rejects(executor.run({ mode: 'crash' }), status(503));
    assert.ok((await executor.run({})).ok);
  } finally { await executor.shutdown(); }

  executor = fixture();
  await executor.run({ mode: 'late-process-close' });
  await pause(60);
  await executor.shutdown();
  assert.ok(!cleanupCalls.includes(123456789), 'Completed jobs must release PIDs even when process close arrives after result');

  executor = fixture();
  await executor.run({ mode: 'late-process-close' });
  const reusedPid = executor.run({ mode: 'tracked-process', delay: 800 });
  const reusedRejected = assert.rejects(reusedPid, status(503));
  await pause(60);
  const previousCleanups = cleanupCalls.length;
  await executor.shutdown();
  await reusedRejected;
  assert.ok(cleanupCalls.slice(previousCleanups).includes(123456789),
    'A late close from the previous job must not clear a PID owned by the next job');

  executor = fixture();
  const active = executor.run({ delay: 800 });
  const pending = executor.run({});
  const activeRejected = assert.rejects(active, status(503));
  const pendingRejected = assert.rejects(pending, status(503));
  await executor.shutdown();
  await Promise.all([activeRejected, pendingRejected]);
  await assert.rejects(executor.run({}), status(503));
  console.log('PASS: worker capacity, owner deduplication, queue cancellation, active cancellation, timeout/crash recovery, late PID cleanup and shutdown');
}

async function runnerLimits() {
  const command = process.env.TEST_PYTHON || python.getPythonCommand();
  if (spawnSync(command, ['--version'], { timeout: 3000, windowsHide: true }).status !== 0) {
    console.log('SKIP: Python runner limits (set TEST_PYTHON to a Python executable)');
    return;
  }
  const original = process.env.PYTHON_EXECUTABLE;
  process.env.PYTHON_EXECUTABLE = command;
  try {
    for (const mode of ['overflow', 'stderr-overflow', 'wait', 'cancel']) {
      const controller = new AbortController();
      let close;
      const closed = new Promise(resolve => { close = resolve; });
      const result = await python.executePythonBot({
        botScriptPath: path.join(__dirname, 'fixtures/pythonRunnerFixture.py'),
        inputPayload: { mode: mode === 'cancel' ? 'wait' : mode },
        timeoutMs: mode === 'wait' ? 300 : 1500,
        signal: controller.signal,
        onSpawn: () => { if (mode === 'cancel') setTimeout(() => controller.abort(), 50); },
        onClose: close,
      });
      assert.equal(result.success, false);
      assert.match(result.error, mode.includes('overflow') ? /OUTPUT_LIMIT/ : mode === 'wait' ? /TIMEOUT/ : /CANCELLED/);
      await Promise.race([closed, pause(2000).then(() => { throw new Error(`Python ${mode} child did not close`); })]);
    }
  } finally {
    if (original === undefined) delete process.env.PYTHON_EXECUTABLE;
    else process.env.PYTHON_EXECUTABLE = original;
  }
  console.log('PASS: Python stdout/stderr output limits, timeout and cancellation terminate children');
}

async function responsiveness() {
  const game = new GameEngine({ size: 9, difficulty: 'hard', maxTurns: 150 });
  const bots = { 1: getPracticeBot('HARD', 1), 2: getPracticeBot('HARD', 2) };
  const began = performance.now();
  let timerObserved;
  const timer = new Promise(resolve => setTimeout(() => { timerObserved = performance.now() - began; resolve(); }, 10));
  while (!game.isGameOver) {
    const decision = bots[game.currentTurnPlayer].chooseMove(game);
    game.executeMove(game.currentTurnPlayer, decision.move);
  }
  const baselineMs = performance.now() - began;
  await timer;
  const executor = createDuelExecutor({ concurrency: 1 });
  const start = performance.now(), gaps = [];
  let previous = start, startedMs, firstStepsMs;
  const heartbeat = setInterval(() => { const now = performance.now(); gaps.push(now - previous); previous = now; }, 10);
  let result;
  try {
    result = await executor.run({ matchId: 'local-responsiveness-test', size: 9, difficulty: 'hard', participants: {
      1: { name: 'Hard one', level: 'HARD' }, 2: { name: 'Hard two', level: 'HARD' },
    } }, { onProgress: event => {
      if (event.type === 'started') startedMs = performance.now() - start;
      if (event.type === 'steps' && firstStepsMs === undefined) firstStepsMs = performance.now() - start;
    } });
  } finally { clearInterval(heartbeat); await executor.shutdown(); }
  assert.ok(startedMs < performance.now() - start);
  assert.ok(firstStepsMs > startedMs);
  assert.ok(gaps.length > 3, 'Main event loop must stay responsive while worker computes');
  assert.equal(result.totalTurns, game.turnCount);
  assert.equal(result.winner, game.winner);
  assert.equal(result.winReason, game.winReason);
  console.log('PASS: real HARD vs HARD worker streams initial board/moves while main loop handles timers');
  console.log(JSON.stringify({ turns: result.totalTurns, synchronousMs: +baselineMs.toFixed(1),
    synchronousTimer10msObserved: +timerObserved.toFixed(1),
    workerStartedMs: +startedMs.toFixed(1), workerFirstMovesMs: +firstStepsMs.toFixed(1),
    mainTimerTicks: gaps.length, mainTimerMaxGapMs: +Math.max(...gaps).toFixed(1) }));
}

(async () => { await lifecycle(); await runnerLimits(); await responsiveness(); })()
  .catch(error => { console.error(error); process.exitCode = 1; });
