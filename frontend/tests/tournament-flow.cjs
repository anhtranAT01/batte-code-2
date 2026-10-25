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
global.window = { addEventListener() {}, removeEventListener() {} };
global.document = { addEventListener() {}, removeEventListener() {} };

function component(name) {
  const filename = path.resolve(__dirname, `../src/components/${name}.jsx`);
  const js = transformSync(fs.readFileSync(filename, 'utf8'), { loader: 'jsx', format: 'cjs' }).code;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)((id) => {
    if (id === '../context/AuthContext') return { useAuth: () => auth };
    if (id === './DeviceSafety' || id === './Icons') return { __esModule: true, default: () => null };
    if (id === '../lib/api') return { apiUrl: (endpoint) => `/api${endpoint}` };
    if (id === '../lib/outbox') {
      return {
        outbox: {
          enqueue: async (...args) => { queued = args; },
          flush: async () => {},
        },
        subscribeOutbox: () => () => {},
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
          ],
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
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            tournament: { id: 't-1', name: 'Vô Địch Arena', status: 'ONGOING' },
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

  act(() => tree.unmount());
  console.log('\nALL FRONTEND TOURNAMENT TEAM TESTS PASSED! 🎉');
}

run().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
