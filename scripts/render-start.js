const { spawn, spawnSync } = require('child_process');

const databaseSetup = spawnSync(process.execPath, ['backend/src/scripts/deployDatabase.js'], {
  stdio: 'inherit',
});

if (databaseSetup.status !== 0) {
  console.error('[Render] Database setup failed; service will not start.');
  process.exit(databaseSetup.status || 1);
}

const processes = [
  spawn(process.execPath, ['backend/src/server.js'], { stdio: 'inherit' }),
  spawn(process.execPath, ['judge-worker/src/index.js'], { stdio: 'inherit' }),
];

let stopping = false;
function stop(signal = 'SIGTERM', exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of processes) {
    if (!child.killed) child.kill(signal);
  }
  setTimeout(() => process.exit(exitCode), 5000).unref();
}

for (const child of processes) {
  child.on('exit', (code, signal) => {
    if (!stopping) {
      console.error(`[Render] Child process stopped (${signal || code}); shutting down service.`);
      stop('SIGTERM', code || 1);
    }
  });
}

process.on('SIGTERM', () => stop('SIGTERM', 0));
process.on('SIGINT', () => stop('SIGINT', 0));
