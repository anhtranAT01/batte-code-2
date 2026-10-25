const assert = require('node:assert/strict');
const { createOnlineCountBroadcaster } = require('./onlineCount');

async function main() {
  let clients = 0;
  const events = [];
  const broadcaster = createOnlineCountBroadcaster({ emit: (...event) => events.push(event) }, {
    delayMs: 20,
    getCount: () => clients,
  });

  for (let i = 1; i <= 100; i += 1) {
    clients = i;
    broadcaster.schedule();
  }
  assert.equal(events.length, 0, 'connection bursts should be coalesced');
  await new Promise(resolve => setTimeout(resolve, 35));
  assert.deepEqual(events, [['online:count', { count: 100 }]], 'broadcast reports the latest count once');

  clients = 99;
  broadcaster.schedule();
  broadcaster.close();
  await new Promise(resolve => setTimeout(resolve, 35));
  assert.equal(events.length, 1, 'shutdown cancels a pending broadcast');
  console.log('PASS: online count coalesces connection bursts and clears its timer on shutdown');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
