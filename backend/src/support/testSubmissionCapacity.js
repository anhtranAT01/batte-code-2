// Local-only HTTP load test. Database and bot files are disposable; no live URLs or credentials are used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');

async function main() {
  if (!process.env.TEST_PGLITE_MODULE) throw new Error('Set TEST_PGLITE_MODULE to an installed @electric-sql/pglite module.');
  const { PGlite } = require(process.env.TEST_PGLITE_MODULE);
  const db = new PGlite();
  const query = (sql, args = []) => args.length ? db.query(sql, args) : db.exec(sql).then(results => results.at(-1) || { rows: [] });
  // Install the isolated database before importing application modules, so dotenv/live services never load.
  const databaseModule = require.resolve('../config/db');
  require.cache[databaseModule] = { id: databaseModule, filename: databaseModule, loaded: true, exports: { query } };
  process.env.JWT_SECRET = randomUUID();
  const botDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'battlecode-capacity-'));
  process.env.BOT_STORAGE_ROOT = botDirectory;
  const express = require('express');
  const jwt = require('jsonwebtoken');
  const app = express();
  app.use(express.json({ limit: '3mb' }));
  app.get('/ping', (req, res) => res.json({ ok: true }));
  app.use('/api/support', require('./support.routes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  let server, queue;
  const report = {
    measuredAt: new Date().toISOString(),
    environment: { type: 'local HTTP + in-memory PGlite; not Render capacity', platform: os.platform(), cpus: os.availableParallelism(), node: process.version },
    ingestion: [],
  };
  try {
    const schema = fs.readFileSync(path.join(__dirname, '../../init.sql'), 'utf8').split('-- Seed default System Administrator account')[0]
      .replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', '').replaceAll('uuid_generate_v4()', 'gen_random_uuid()');
    await db.exec(schema);
    await db.exec(fs.readFileSync(path.join(__dirname, '../scripts/resilience.sql'), 'utf8'));
    await db.exec('ALTER TABLE "Bots" ADD COLUMN tactic TEXT');
    const users = Array.from({ length: 1000 }, (_, index) => ({ id: randomUUID(), username: `capacity_${index}` }));
    await query(`INSERT INTO "Users" (id, username, password_hash)
      SELECT (value->>'id')::uuid, value->>'username', 'local-test-only' FROM jsonb_array_elements($1::jsonb)`, [JSON.stringify(users)]);
    const tokens = users.map(user => jwt.sign({ id: user.id }, process.env.JWT_SECRET));
    const originalSource = fs.readFileSync(path.join(__dirname, '../../../sample-bots/heuristic.py'), 'utf8');
    const source = originalSource + '\n#' + 'x'.repeat(Math.max(0, 20 * 1024 - Buffer.byteLength(originalSource) - 2));
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;

    async function submit(index, contents = source, id = randomUUID()) {
      const began = performance.now();
      try {
        const response = await fetch(`${base}/api/support/submissions`, {
          method: 'POST', signal: AbortSignal.timeout(15000),
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens[index]}` },
          body: JSON.stringify({ id, name: 'Capacity test', source: contents }),
        });
        const data = await response.json();
        if (response.ok) assert.equal(data.data?.id, id, 'server receipt must match the submitted ID');
        return { status: response.status, ms: performance.now() - began };
      } catch (error) {
        if (error instanceof assert.AssertionError) throw error;
        return { status: 0, error: error.cause?.code || error.name, ms: performance.now() - began };
      }
    }

    const percentile = (sorted, percent) => +sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percent) - 1)].toFixed(1);
    async function burst(total, concurrency, contents = source) {
      await db.exec('DELETE FROM "Submissions"');
      let cursor = 0;
      const results = [], failures = [], began = performance.now();
      await Promise.all(Array.from({ length: concurrency }, async () => {
        while (cursor < total) {
          const index = cursor++;
          const id = randomUUID();
          let result = await submit(index, contents, id);
          if (!result.status || result.status >= 500) {
            failures.push(result.error || String(result.status));
            const initialMs = result.ms;
            await new Promise(resolve => setTimeout(resolve, 500));
            result = await submit(index, contents, id);
            result.ms += initialMs + 500;
          }
          results.push({ ...result, index, id });
        }
      }));
      const elapsedMs = performance.now() - began;
      const times = results.map(result => result.ms).sort((a, b) => a - b);
      const statuses = Object.fromEntries([...new Set(results.map(result => result.status))].map(status => [status, results.filter(result => result.status === status).length]));
      const row = { users: total, concurrentRequests: concurrency, sourceBytes: Buffer.byteLength(contents), statuses,
        initialFailures: failures.length, initialFailureCodes: [...new Set(failures)],
        elapsedMs: +elapsedMs.toFixed(1), attemptedUsersPerSecond: +(1000 * total / elapsedMs).toFixed(1),
        confirmedUsersPerSecond: +(1000 * ((statuses[202] || 0) + (statuses[200] || 0)) / elapsedMs).toFixed(1),
        p50Ms: percentile(times, 0.5), p95Ms: percentile(times, 0.95), p99Ms: percentile(times, 0.99) };
      report.ingestion.push(row);
      row.storedAfterBurst = (await query('SELECT count(*)::int AS n FROM "Submissions"')).rows[0].n;
      const unconfirmed = results.filter(result => ![200, 202].includes(result.status));
      row.unconfirmedAfterOneRetry = unconfirmed.length;
      // A stress probe may exceed the socket accept queue. Recover using the original
      // IDs at lower concurrency, like the browser's durable outbox after backoff.
      if (unconfirmed.length) {
        const recoveringAt = performance.now();
        await new Promise(resolve => setTimeout(resolve, 2000));
        let retryCursor = 0;
        await Promise.all(Array.from({ length: Math.min(20, unconfirmed.length) }, async () => {
          while (retryCursor < unconfirmed.length) {
            const pending = unconfirmed[retryCursor++];
            let retried;
            for (let attempt = 0; attempt < 3; attempt++) {
              retried = await submit(pending.index, contents, pending.id);
              if ([200, 202].includes(retried.status)) break;
              await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
            }
            assert.ok([200, 202].includes(retried.status), 'pending source must be recoverable using the same ID');
          }
        }));
        row.recoveryElapsedMs = +(performance.now() - recoveringAt).toFixed(1);
      }
      row.storedAfterRecovery = (await query('SELECT count(*)::int AS n FROM "Submissions"')).rows[0].n;
      console.log('INGESTION', JSON.stringify(row));
      if (concurrency <= 100) assert.equal(unconfirmed.length, 0, 'the normal-sized burst should not need a second recovery phase');
      assert.equal((await query('SELECT count(*)::int AS n FROM "Submissions"')).rows[0].n, total);
    }

    // Warm the database/query plans and HTTP client before the measured scenarios.
    await submit(0);
    for (const [users, concurrency] of [[50, 10], [200, 50], [500, 100], [1000, 200], [1000, 500], [1000, 1000]]) await burst(users, concurrency);
    await burst(10, 10, originalSource + '\n#' + 'x'.repeat(2 * 1024 * 1024 - Buffer.byteLength(originalSource) - 2));

    await db.exec('DELETE FROM "Submissions"');
    const quota = await Promise.all(Array.from({ length: 40 }, () => submit(0)));
    const accepted = quota.filter(result => result.status === 202).length;
    const limited = quota.filter(result => result.status === 429).length;
    assert.equal(accepted, 20); assert.equal(limited, 20);
    const originalId = (await query('SELECT id FROM "Submissions" LIMIT 1')).rows[0].id;
    assert.equal((await submit(0, source, originalId)).status, 200, 'retry should still work when the owner has 20 pending submissions');

    await db.exec('DELETE FROM "Submissions"');
    const duplicateId = randomUUID();
    const duplicates = await Promise.all(Array.from({ length: 100 }, () => submit(1, source, duplicateId)));
    assert.equal(duplicates.filter(result => result.status === 202).length, 1);
    assert.equal(duplicates.filter(result => result.status === 200).length, 99);
    assert.equal((await query('SELECT count(*)::int AS n FROM "Submissions"')).rows[0].n, 1);
    const oversized = await submit(2, 'x'.repeat(2 * 1024 * 1024 + 1));
    assert.ok([400, 413].includes(oversized.status));
    const oversizedUtf8 = await submit(2, '漢'.repeat(750000));
    assert.equal(oversizedUtf8.status, 413);
    const anonymous = await fetch(`${base}/api/support/submissions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(anonymous.status, 401);
    report.boundaries = { pendingPerAccount: accepted, rejectedOverQuota: limited, duplicateRetries: duplicates.length, storedCopies: 1,
      oversizedAsciiStatus: oversized.status, oversizedUtf8Status: oversizedUtf8.status, anonymousStatus: anonymous.status };
    console.log('BOUNDARIES', JSON.stringify(report.boundaries));

    // Exercise the real scheduler, worker, Python syntax check, both player sides, file persistence and receipt update.
    await db.exec('DELETE FROM "Submissions"');
    const judgeSamples = Math.max(1, Math.min(1000, Number(process.env.SUBMISSION_JUDGE_SAMPLES) || 8));
    for (let index = 0; index < judgeSamples; index++) await submit(index, originalSource);
    queue = require('./submissionQueue');
    const started = performance.now(), pingTimes = [];
    queue.start();
    const judgeDeadlineMs = Math.max(60000, judgeSamples * 2000);
    let lastProgress = 0;
    while (performance.now() - started < judgeDeadlineMs) {
      const rows = await query('SELECT status, count(*)::int AS n FROM "Submissions" GROUP BY status');
      const statuses = Object.fromEntries(rows.rows.map(row => [row.status, row.n]));
      if ((statuses.accepted || 0) >= lastProgress + 25) {
        lastProgress = statuses.accepted;
        console.log(`JUDGE_PROGRESS ${statuses.accepted}/${judgeSamples}`);
      }
      if (statuses.rejected) throw new Error(`Valid sample unexpectedly rejected: ${JSON.stringify(await query('SELECT message FROM "Submissions" WHERE status=\'rejected\''))}`);
      if (statuses.accepted === judgeSamples) break;
      const pingStart = performance.now();
      assert.equal((await (await fetch(`${base}/ping`)).json()).ok, true);
      pingTimes.push(performance.now() - pingStart);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    queue.stop();
    const elapsedMs = performance.now() - started;
    const statuses = Object.fromEntries((await query('SELECT status, count(*)::int AS n FROM "Submissions" GROUP BY status')).rows.map(row => [row.status, row.n]));
    assert.equal(statuses.accepted, judgeSamples, 'real Python queue must drain every valid submission within one minute');
    assert.equal((await query('SELECT count(*)::int AS n FROM "Bots"')).rows[0].n, judgeSamples);
    pingTimes.sort((a, b) => a - b);
    report.judge = { submissions: judgeSamples, elapsedMs: +elapsedMs.toFixed(1), submissionsPerMinute: +(judgeSamples * 60000 / elapsedMs).toFixed(1),
      pingP95Ms: percentile(pingTimes, 0.95), statuses };
    console.log('JUDGE', JSON.stringify(report.judge));

    await db.exec('DELETE FROM "Submissions"');
    await query(`INSERT INTO "SystemSettings" (key,value) VALUES ('judge','{"paused":true}')`);
    await submit(20, originalSource);
    queue.start(); queue.start();
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.equal((await query('SELECT attempts FROM "Submissions"')).rows[0].attempts, 0, 'paused queue must leave work pending');
    queue.stop();
    await query(`UPDATE "SystemSettings" SET value='{"paused":false}' WHERE key='judge'`);
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.equal((await query('SELECT attempts FROM "Submissions"')).rows[0].attempts, 0, 'stop must cancel future polling');
    queue.start(); queue.start();
    const restartAt = performance.now();
    while (performance.now() - restartAt < 10000) {
      if ((await query('SELECT status FROM "Submissions"')).rows[0].status === 'accepted') break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    queue.stop();
    assert.deepEqual((await query('SELECT status,attempts FROM "Submissions"')).rows, [{ status: 'accepted', attempts: 1 }]);
    report.scheduler = { pausePreservesPending: true, stopCancelsPolling: true, repeatedStartProcessesExactlyOnce: true };
    console.log('PASS: isolated submission load, size/account boundaries, idempotent retries and real Python queue');
    report.completed = true;
  } finally {
    if (process.env.SUBMISSION_CAPACITY_REPORT) fs.writeFileSync(process.env.SUBMISSION_CAPACITY_REPORT, JSON.stringify(report, null, 2) + '\n');
    queue?.stop();
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections?.(); });
    await db.close();
    // Delete only this test's freshly created directory, never the configured production bot path.
    const resolved = path.resolve(botDirectory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('battlecode-capacity-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
