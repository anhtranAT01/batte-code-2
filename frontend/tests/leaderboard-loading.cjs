const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { transformSync } = require('esbuild');

function load(filename, imports = {}) {
  const source = fs.readFileSync(path.resolve(__dirname, filename), 'utf8');
  const js = transformSync(source, { loader: filename.endsWith('.jsx') ? 'jsx' : 'js', format: 'cjs' }).code;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(id => {
    if (Object.hasOwn(imports, id)) return imports[id];
    if (id.endsWith('.css')) return {};
    return require(id);
  }, module, module.exports);
  return module.exports;
}
const cache = load('../src/lib/publicData.js');
const Leaderboard = load('../src/components/LeaderboardView.jsx', {
  '../context/AuthContext': { useAuth: () => ({ user: { id: 'me' } }) },
  '../lib/publicData': cache,
  '../lib/matchLabel': load('../src/lib/matchLabel.js'),
}).default;
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const response = data => ({ ok: true, json: async () => ({ success: true, data }) });
const stringify = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(stringify).join('')
  : node ? stringify(node.props?.children ?? node.children) : '';
const body = tree => stringify(tree.toJSON());
const player = { id: 'me', username: 'Visible before history', elo_rating: 1180 };

async function main() {
  const leaderboard = deferred();
  const history = deferred();
  let calls = 0;
  global.fetch = url => { calls++; return url.includes('leaderboard') ? leaderboard.promise : history.promise; };
  let tree;
  await act(async () => { tree = create(React.createElement(Leaderboard)); });
  await act(async () => { leaderboard.resolve(response([player])); });
  assert.match(body(tree), /Visible before history/);
  assert.match(body(tree), /Đang tải trận đấu gần đây/);
  const selfButton = tree.root.findAllByType('button').find(node => stringify(node.props.children) === 'Bạn');
  assert.equal(selfButton.props.disabled, true);
  await act(async () => { history.resolve(response([])); });
  act(() => tree.unmount());
  await act(async () => { tree = create(React.createElement(Leaderboard)); });
  assert.equal(calls, 2, 'Returning to leaderboard reuses fresh public summaries');
  assert.match(body(tree), /Visible before history/);
  global.fetch = async () => { throw new Error('Server unavailable'); };
  const refresh = tree.root.findAllByType('button').find(node => stringify(node.props.children) === 'Làm mới');
  await act(async () => { refresh.props.onClick(); });
  assert.match(body(tree), /Visible before history/, 'Refresh errors retain previously loaded rows');
  assert.equal(tree.root.findAllByProps({ role: 'alert' }).length, 2);
  act(() => tree.unmount());
  console.log('PASS: leaderboard is independent from slow history, reuses summaries and preserves rows on refresh errors');

  cache.invalidatePublicData();
  const pending = deferred();
  calls = 0;
  global.fetch = () => { calls++; return pending.promise; };
  const first = cache.getPublicData('/test');
  const second = cache.getPublicData('/test');
  assert.equal(first, second, 'Concurrent readers share one request');
  cache.invalidatePublicData();
  pending.resolve(response(['old']));
  await first;
  assert.equal(cache.peekPublicData('/test'), undefined, 'An old request cannot repopulate an invalidated cache');
  global.fetch = async () => { calls++; return response(['new']); };
  assert.deepEqual(await cache.getPublicData('/test'), ['new']);
  assert.equal(calls, 2);
  cache.invalidatePublicData();
  let attempts = 0;
  global.fetch = async () => { attempts++; if (attempts === 1) throw new Error('offline'); return response([]); };
  await assert.rejects(cache.getPublicData('/retry'), /offline/);
  await cache.getPublicData('/retry');
  assert.equal(attempts, 2, 'Failed requests are never cached');
  console.log('PASS: public request dedupe, cache invalidation races and retry after failure');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
