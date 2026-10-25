const assert = require('node:assert/strict');
const path = require('path');
const { buildSync } = require('esbuild');

const output = buildSync({
  entryPoints: [path.resolve(__dirname, '../src/lib/outbox.js')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
});
const moduleUnderTest = { exports: {} };
new Function('module', 'exports', output.outputFiles[0].text)(moduleUnderTest, moduleUnderTest.exports);
const { createOutbox } = moduleUnderTest.exports;

async function testOfflineOutboxE2E() {
  console.log('Testing Offline Outbox E2E flow...');
  const rows = new Map();
  const serverDatabase = new Map();
  let serverOnline = false;
  let now = 1000;
  let counter = 0;

  const store = {
    put: async (row) => rows.set(row.id, structuredClone(row)),
    list: async () => [...rows.values()].map((x) => structuredClone(x)),
    remove: async (id) => rows.delete(id),
  };

  const userSession = { userId: 'student-uuid-1', token: 'jwt-student-1' };

  // Simulated server HTTP endpoint
  const simulatedFetch = async (url, init) => {
    if (url.includes('/auth/me')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { id: userSession.userId } }),
      };
    }

    if (!serverOnline) {
      return {
        ok: false,
        status: 503,
        json: async () => ({ message: 'Simulated server outage / No network' }),
      };
    }

    if (url.includes('/support/submissions')) {
      const body = JSON.parse(init.body);
      if (!serverDatabase.has(body.id)) {
        serverDatabase.set(body.id, {
          id: body.id,
          name: body.name,
          status: 'accepted',
          received_at: new Date(now).toISOString(),
          message: 'Server accepted bot and verified Python code',
        });
        return {
          ok: true,
          status: 202,
          json: async () => ({ success: true, data: serverDatabase.get(body.id) }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: serverDatabase.get(body.id) }),
      };
    }

    if (url.includes('/support/questions')) {
      const body = JSON.parse(init.body);
      const q = {
        id: body.id,
        category: body.category,
        question: body.question,
        answer: null,
        is_public: false,
      };
      serverDatabase.set(q.id, q);
      return {
        ok: true,
        status: 201,
        json: async () => ({ success: true, data: q }),
      };
    }

    return { ok: false, status: 404, json: async () => ({ message: 'Not found' }) };
  };

  const queue = createOutbox({
    store,
    now: () => now,
    uuid: () => `uuid-${++counter}`,
    fetcher: simulatedFetch,
  });

  // 1. Submit bot while OFFLINE
  console.log('1. Submitting bot while server is offline...');
  serverOnline = false;
  const enqueuedBot = await queue.enqueue(userSession.userId, 'bot', {
    name: 'MyResilientBot',
    source: 'def make_move(game_state): return {"action": "MOVE", "direction": "UP"}',
  });

  assert.equal(enqueuedBot.state, 'queued');
  assert.equal(enqueuedBot.id, 'uuid-1');
  assert.equal(serverDatabase.size, 0, 'Server must have received nothing while offline');

  // Check state on device
  let itemsOnDevice = await queue.list(userSession.userId);
  assert.equal(itemsOnDevice.length, 1);
  assert.equal(itemsOnDevice[0].state, 'queued');
  assert.equal(itemsOnDevice[0].payload.name, 'MyResilientBot');
  console.log('✓ Bot successfully preserved on device as "queued" (Lưu trên thiết bị)');

  // 2. Outbox pump tries to flush while STILL OFFLINE
  console.log('2. Outbox pump triggers while still offline...');
  now += 10000;
  await queue.flush(() => userSession);

  itemsOnDevice = await queue.list(userSession.userId);
  assert.equal(itemsOnDevice[0].state, 'queued', 'Should still be queued');
  assert.equal(serverDatabase.size, 0, 'Server still has 0 entries');
  console.log('✓ Submission remains safely queued, no data lost, not claimed saved to server');

  // 3. Network / Server RECOVERS (online)
  console.log('3. Connection restored. Outbox pump triggers sync...');
  serverOnline = true;
  now += 10000;
  await queue.flush(() => userSession);

  itemsOnDevice = await queue.list(userSession.userId);
  const botItem = itemsOnDevice.find((x) => x.id === 'uuid-1');
  assert.equal(botItem.state, 'received', 'Must transition to received upon receipt');
  assert.equal(serverDatabase.size, 1, 'Server received the item');
  assert.equal(serverDatabase.get('uuid-1').name, 'MyResilientBot');
  console.log('✓ Outbox pump automatically delivered submission to server with valid receipt');

  // 4. Repeated sync with same ID (idempotency check)
  console.log('4. Retrying flush with already received item (idempotency check)...');
  await queue.flush(() => userSession);
  assert.equal(serverDatabase.size, 1, 'Duplicate submissions prevented by idempotency key');
  console.log('✓ No duplicate submissions created on retry');

  // 5. Submit Question to Admin/Teacher while OFFLINE then ONLINE
  console.log('5. Submitting QA question while offline, then auto-sending when online...');
  serverOnline = false;
  const enqueuedQ = await queue.enqueue(userSession.userId, 'question', {
    category: 'technical',
    question: 'Làm sao để nộp bot Python khi bị mất mạng?',
  });
  assert.equal(enqueuedQ.state, 'queued');
  assert.equal(enqueuedQ.id, 'uuid-2');

  now += 10000;
  serverOnline = true;
  await queue.flush(() => userSession);

  const qItems = await queue.list(userSession.userId);
  const qItem = qItems.find((x) => x.kind === 'question');
  assert.ok(qItem, 'Question item must exist in outbox');
  assert.equal(qItem.state, 'received', 'Question must be marked received once online');
  assert.equal(serverDatabase.get('uuid-2').question, 'Làm sao để nộp bot Python khi bị mất mạng?');
  console.log('✓ Question safely buffered offline and delivered to Admin/Teacher upon reconnect');

  console.log('\nALL E2E OFFLINE RESILIENCE & QA OUTBOX TESTS PASSED!');
}

testOfflineOutboxE2E().catch((err) => {
  console.error('Test failed:', err);
  process.exitCode = 1;
});
