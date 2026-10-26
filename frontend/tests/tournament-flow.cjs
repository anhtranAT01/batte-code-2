const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { transformSync } = require('esbuild');

let auth = {
  user: { id: 'u1', username: 'TestUser', team_name: 'ExistingTeam', role: 'STUDENT' },
  token: 'mock-token',
  getAuthHeaders: () => ({ Authorization: 'Bearer mock-token' }),
  refreshProfile: () => {},
};

let queued = null;
let lastScrolledId = null;
let rowBuilds = 0;
let outboxListener;
const screenModule={exports:{}};
new Function('module','exports',transformSync(fs.readFileSync(path.resolve(__dirname,'../src/lib/screenData.js'),'utf8'),{format:'cjs'}).code)(screenModule,screenModule.exports);
global.window = { addEventListener() {}, removeEventListener() {} };
global.document = {
  addEventListener() {},
  removeEventListener() {},
  getElementById: (id) => ({
    scrollIntoView: () => {
      lastScrolledId = id;
    },
  }),
};

function component(name) {
  const filename = path.resolve(__dirname, `../src/components/${name}.jsx`);
  const js = transformSync(fs.readFileSync(filename, 'utf8'), { loader: 'jsx', format: 'cjs' }).code;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)((id) => {
    if (id === 'react') return { ...React, createElement: (...args) => { if (args[0] === 'tr') rowBuilds++; return React.createElement(...args); } };
    if (id === '../context/AuthContext') return { useAuth: () => auth };
    if (id === './DeviceSafety' || id === './Icons') return { __esModule: true, default: () => null };
    if (id === '../lib/api') return { apiUrl: (endpoint) => `/api${endpoint}` };
    if (id === '../lib/screenData') return screenModule.exports;
    if (id === '../lib/outbox') {
      return {
        outbox: {
          enqueue: async (...args) => { queued = args; },
          flush: async () => {},
        },
        subscribeOutbox: callback => { outboxListener = callback; return () => { outboxListener = null; }; },
      };
    }
    return require(id);
  }, module, module.exports);
  return module.exports.default;
}

const TournamentBracketsView = component('TournamentBracketsView');
const text = (element) => Array.isArray(element)
  ? element.map(text).join('')
  : typeof element === 'object' && element
  ? text(element.props?.children)
  : String(element ?? '');

async function run() {
  console.log('Testing Frontend TournamentBracketsView Team Management & Registration...');

  // Mock API calls
  let branchJoinBody = null;
  global.fetch = async (url, init) => {
    if (url === '/api/tournaments') {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: 't-1',
              name: 'Vô Địch Arena',
              status: 'ONGOING',
              mode: 'ALL_IN',
              max_participants: 100,
            },
            {
              id: 't-2',
              name: 'Nhánh Tứ Kết Cúp',
              status: 'UPCOMING',
              mode: 'BRANCHES',
              max_participants: 16,
            },
            { id: 't-3', name: 'Slow tournament', status: 'UPCOMING', mode: 'BRANCHES', max_participants: 16 },
          ],
        }),
      };
    }
    if (url.includes('/brackets/join')) {
      branchJoinBody = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({
          success: true,
          message: 'Ghi danh nhánh đấu thành công',
        }),
      };
    }
    if (url === '/api/tournaments/teams') {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: [
            { name: 'Cyber Warriors', memberCount: 3 },
            { name: 'AI Titans', memberCount: 2 },
          ],
        }),
      };
    }
    if (url === '/api/bots/my-bots') {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: [
            { id: 'b-1', name: 'AlphaBot', is_active: true },
          ],
        }),
      };
    }
    if (url.includes('/standings')) {
      if (url.includes('t-2')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              tournament: {
                id: 't-2',
                name: 'Nhánh Tứ Kết Cúp',
                status: 'UPCOMING',
                mode: 'BRANCHES',
                brackets: [
                  { id: 'qf-1', round: 1, title: 'Tứ Kết 1', status: 'PENDING', p1: null, p2: null },
                  { id: 'qf-2', round: 1, title: 'Tứ Kết 2', status: 'PENDING', p1: null, p2: null },
                ],
              },
              standings: [],
            },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            tournament: { id: 't-1', name: 'Vô Địch Arena', status: 'ONGOING', mode: 'ALL_IN', scheduledStartAt: new Date(Date.now()+60000).toISOString() },
            standings: [
              {
                userId: 'u1',
                username: 'TestUser',
                teamName: 'Cyber Warriors',
                botName: 'AlphaBot',
                points: 9,
                wins: 3,
                losses: 0,
                elo: 1450,
              },
              {
                userId: 'u2',
                username: 'RivalUser',
                teamName: 'AI Titans',
                botName: 'BetaBot',
                points: 6,
                wins: 2,
                losses: 1,
                elo: 1320,
              },
            ],
          },
        }),
      };
    }
    return { ok: true, json: async () => ({ success: true }) };
  };

  let tree;
  await act(async () => {
    tree = create(React.createElement(TournamentBracketsView));
  });

  // Verify headers include 'ĐỘI / TEAM'
  const thHeaders = tree.root.findAllByType('th').map((th) => text(th.props.children));
  assert.ok(thHeaders.includes('ĐỘI / TEAM'), 'Table headers must include ĐỘI / TEAM');
  console.log('✓ Standings table header contains "ĐỘI / TEAM"');

  // Verify team names rendered in the table
  const cells = tree.root.findAllByType('td').map((td) => text(td.props.children));
  assert.ok(cells.some((c) => c.includes('Cyber Warriors')), 'Cyber Warriors must be rendered in table');
  assert.ok(cells.some((c) => c.includes('AI Titans')), 'AI Titans must be rendered in table');
  console.log('✓ Team names rendered in participant standings');

  const rowsBeforeClock = rowBuilds;
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 1100)); });
  assert.equal(rowBuilds, rowsBeforeClock, 'countdown ticks must not rebuild the standings table');
  console.log('✓ Countdown updates without rebuilding standings rows');

  const beforeBurstFetch = global.fetch;
  let standingsRefreshes = 0;
  global.fetch = (...args) => { if (String(args[0]).includes('/standings')) standingsRefreshes++; return beforeBurstFetch(...args); };
  await act(async () => {
    for (let index=0; index<20; index++) outboxListener();
    await new Promise(resolve => setTimeout(resolve, 350));
  });
  assert.equal(standingsRefreshes, 1, 'an outbox sync burst must only refresh standings once');
  global.fetch = beforeBurstFetch;
  console.log('✓ Outbox notification bursts share one standings refresh');

  // Verify Team Input exists
  const teamInput = tree.root.findByProps({ placeholder: 'Nhập tên đội hoặc tìm bên dưới...' });
  assert.ok(teamInput, 'Team input field must exist');
  console.log('✓ Team input field is present');

  // Change team name to 'Robo Force'
  await act(async () => {
    teamInput.props.onChange({ target: { value: 'Robo Force' } });
  });

  // Find registration button and click
  const regButton = tree.root.findAllByType('button').find((b) =>
    text(b.props.children).includes('Tham Gia') || text(b.props.children).includes('Cập Nhật')
  );
  assert.ok(regButton, 'Register / Update button must exist');

  await act(async () => {
    regButton.props.onClick();
  });

  // Verify outbox queued with teamName
  assert.ok(queued, 'Outbox must receive registration payload');
  assert.equal(queued[0], 'u1');
  assert.equal(queued[1], 'tournament');
  assert.equal(queued[2].tournamentId, 't-1');
  assert.equal(queued[2].botId, 'b-1');
  assert.equal(queued[2].teamName, 'Robo Force');
  console.log('✓ outbox.enqueue called with teamName "Robo Force"');

  // Test Standings Filter
  const filterInput = tree.root.findByProps({ placeholder: 'Tìm sinh viên, đội, bot...' });
  assert.ok(filterInput, 'Filter input must exist');

  await act(async () => {
    filterInput.props.onChange({ target: { value: 'Titans' } });
  });

  const filteredRows = tree.root.findAllByType('tbody')[0].findAllByType('tr');
  assert.equal(filteredRows.length, 1, 'Only 1 row matching Titans should be visible');
  assert.ok(text(filteredRows[0].props.children).includes('RivalUser'));
  console.log('✓ Filter by team name accurately filters the standings list');

  // TEST BRANCHES MODE & INTERACTIVE BRACKET JUMPING
  console.log('Testing BRANCHES Mode & Interactive Bracket Jumping...');

  // 1. Click switch to Mục 2: Nhánh Đấu
  const branchModeBtn = tree.root.findAllByType('button').find((b) =>
    text(b.props.children).includes('Mục 2: Các Giải Đấu Riêng Lẻ & Nhánh Đấu')
  );
  assert.ok(branchModeBtn, 'Branch mode button must exist');
  await act(async () => {
    branchModeBtn.props.onClick();
  });

  // 2. Select tournament t-2
  const tourneySelect = tree.root.findAllByType('select').find((s) =>
    s.props['aria-label'] === 'Giải đấu đã chọn'
  );
  assert.ok(tourneySelect, 'Tournament selector must exist');
  await act(async () => {
    tourneySelect.props.onChange({ target: { value: 't-2' } });
  });

  // 3. Verify Quick Branch Chip buttons rendered (Nhánh 1, Nhánh 2)
  const branchChip2 = tree.root.findAllByType('button').find((b) =>
    text(b.props.children).includes('Nhánh 2')
  );
  assert.ok(branchChip2, 'Quick branch chip "Nhánh 2" must be rendered');

  // Click Nhánh 2 quick chip -> should trigger smooth scroll down to bracket-match-qf-2
  await act(async () => {
    branchChip2.props.onClick();
    await new Promise((r) => setTimeout(r, 120));
  });

  assert.equal(lastScrolledId, 'bracket-match-qf-2', 'Selecting Nhánh 2 must scroll down to bracket-match-qf-2');
  console.log('✓ Selecting Nhánh 2 immediately triggered smooth scroll down to bracket-match-qf-2');

  // 4. Select Slot 2 button
  const slot2Btn = tree.root.findAllByType('button').find((b) =>
    text(b.props.children).includes('Vị trí 2 (Slot 2)')
  );
  assert.ok(slot2Btn, 'Slot 2 button must exist');
  await act(async () => {
    slot2Btn.props.onClick();
    await new Promise((r) => setTimeout(r, 120));
  });

  // 5. Click Register / Join Bracket button
  const joinBtn = tree.root.findAllByType('button').find((b) =>
    text(b.props.children).includes('Ghi Danh Vào Nhánh Đấu') || text(b.props.children).includes('Cập Nhật Nhánh')
  );
  assert.ok(joinBtn, 'Join bracket button must exist');

  await act(async () => {
    joinBtn.props.onClick();
    await new Promise((r) => setTimeout(r, 120));
  });

  assert.ok(branchJoinBody, 'POST /brackets/join must be sent');
  assert.equal(branchJoinBody.bracketMatchId, 'qf-2', 'Bracket match ID must be qf-2');
  assert.equal(branchJoinBody.slot, 'p2', 'Slot must be p2');
  assert.equal(branchJoinBody.botId, 'b-1', 'Bot ID must match selected bot b-1');
  assert.equal(branchJoinBody.teamName, 'Robo Force', 'Team name must match Robo Force');
  console.log('✓ Successfully joined bracket slot qf-2 (Slot 2) with team and bot');

  const originalFetch = global.fetch;
  let resolveSlow, slowSignal;
  global.fetch = (url, options) => {
    if (url === '/api/tournaments/t-3/standings') {
      slowSignal = options.signal;
      return new Promise(resolve => { resolveSlow = resolve; });
    }
    return originalFetch(url, options);
  };
  await act(async () => { tourneySelect.props.onChange({ target: { value: 't-3' } }); });
  await act(async () => { tourneySelect.props.onChange({ target: { value: 't-2' } }); });
  assert.equal(slowSignal.aborted, true, 'switching tournaments cancels the previous request');
  await act(async () => {
    resolveSlow({ ok: true, json: async () => ({ data: { tournament: { id: 't-3', name: 'STALE_STANDINGS', mode: 'BRANCHES' }, standings: [] } }) });
  });
  assert.equal(tree.root.findAllByProps({ id: 'bracket-match-qf-2' }).length, 1, 'the selected tournament brackets must survive an old response');
  assert.equal(tourneySelect.props.value, 't-2');
  console.log('✓ Late standings cannot replace the newly selected tournament');

  act(() => tree.unmount());
  console.log('\nALL FRONTEND TOURNAMENT TEAM & BRANCH JUMPING TESTS PASSED! 🎉');
}

run().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
