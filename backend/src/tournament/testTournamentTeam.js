const assert = require('node:assert/strict');
const { pool, query } = require('../config/db');
const tournamentService = require('./tournament.service');

async function runTest() {
  console.log('Testing Tournament Registration & Team Management...');

  // Setup test user, test bot, test ongoing tournament
  const userId = '12345678-aaaa-bbbb-cccc-111111111111';
  const bot1Id = '12345678-aaaa-bbbb-cccc-222222222222';
  const bot2Id = '12345678-aaaa-bbbb-cccc-333333333333';
  const tourneyId = '12345678-aaaa-bbbb-cccc-444444444444';

  try {
    // 1. Clean previous test artifacts
    await query('DELETE FROM "Tournaments" WHERE id = $1', [tourneyId]);
    await query('DELETE FROM "Bots" WHERE id IN ($1, $2)', [bot1Id, bot2Id]);
    await query('DELETE FROM "Users" WHERE id = $1', [userId]);

    // 2. Insert test user
    await query(
      `INSERT INTO "Users" (id, username, password_hash, role, elo_rating, team_name)
       VALUES ($1, 'test_fighter', 'hash', 'STUDENT', 1400, NULL)`,
      [userId]
    );

    // 3. Insert test active bots
    await query(
      `INSERT INTO "Bots" (id, user_id, name, status, file_path_or_git_url)
       VALUES ($1, $2, 'Bot Alpha', 'active', '/tmp/bot1.py'),
              ($3, $2, 'Bot Beta', 'active', '/tmp/bot2.py')`,
      [bot1Id, userId, bot2Id]
    );

    // 4. Insert an ONGOING tournament with scheduled_start_at in the past
    const pastDate = new Date(Date.now() - 3600000).toISOString();
    await query(
      `INSERT INTO "Tournaments" (id, name, status, max_participants, scheduled_start_at, settings_json)
       VALUES ($1, 'Grand Ongoing Arena', 'ONGOING', 50, $2, $3)`,
      [tourneyId, pastDate, JSON.stringify({ mode: 'ALL_IN', participants: [] })]
    );

    // TEST 1: Register for ONGOING tournament with a team name
    console.log('1. Registering for ONGOING tournament with a team name...');
    const regResult = await tournamentService.registerStudent({
      tournamentId: tourneyId,
      userId,
      botId: bot1Id,
      teamName: 'Cyber Warriors',
    });

    assert.equal(regResult.success, true, 'Registration must succeed for ONGOING tournament');
    assert.equal(regResult.teamName, 'Cyber Warriors');
    assert.equal(regResult.totalParticipants, 1);
    console.log('✓ Successfully registered in ONGOING tournament with team "Cyber Warriors"');

    // Verify Users table updated
    const userRow = (await query('SELECT team_name FROM "Users" WHERE id = $1', [userId])).rows[0];
    assert.equal(userRow.team_name, 'Cyber Warriors', 'Users table must have team_name updated');
    console.log('✓ User profile team_name synchronized');

    // TEST 2: Update registration with another bot and another team (no 409 conflict!)
    console.log('2. Updating registration with new bot and new team...');
    const updateResult = await tournamentService.registerStudent({
      tournamentId: tourneyId,
      userId,
      botId: bot2Id,
      teamName: 'Cyber Warriors V2',
    });

    assert.equal(updateResult.success, true);
    assert.equal(updateResult.teamName, 'Cyber Warriors V2');
    assert.equal(updateResult.totalParticipants, 1, 'Participant count must remain 1');
    console.log('✓ Successfully updated registration without conflict');

    // TEST 3: User renames team via updateUserTeam
    console.log('3. Renaming team via updateUserTeam...');
    const renameResult = await tournamentService.updateUserTeam({
      userId,
      teamName: 'AI Champions Elite',
      tournamentId: tourneyId,
    });

    assert.equal(renameResult.success, true);
    assert.equal(renameResult.teamName, 'AI Champions Elite');

    const userRow2 = (await query('SELECT team_name FROM "Users" WHERE id = $1', [userId])).rows[0];
    assert.equal(userRow2.team_name, 'AI Champions Elite');
    console.log('✓ Team renamed to "AI Champions Elite" across profile and tournament');

    // TEST 4: getTournamentTeams lists the team
    console.log('4. Listing available teams via getTournamentTeams...');
    const teams = await tournamentService.getTournamentTeams(tourneyId);
    const foundTeam = teams.find((t) => t.name === 'AI Champions Elite');
    assert.ok(foundTeam, 'Team "AI Champions Elite" must be in available teams list');
    console.log('✓ getTournamentTeams returned created team for search / suggestions');

    // TEST 5: getTournamentStandings includes teamName
    console.log('5. Checking tournament standings includes teamName...');
    const { standings } = await tournamentService.getTournamentStandings(tourneyId);
    assert.equal(standings.length, 1);
    assert.equal(standings[0].userId, userId);
    assert.equal(standings[0].username, 'test_fighter');
    assert.equal(standings[0].teamName, 'AI Champions Elite');
    assert.equal(standings[0].botName, 'Bot Beta');
    console.log('✓ Standings returned correct teamName and botName');

    console.log('\nALL TOURNAMENT REGISTRATION & TEAM MANAGEMENT TESTS PASSED! 🎉');
  } finally {
    // Cleanup
    await query('DELETE FROM "Tournaments" WHERE id = $1', [tourneyId]);
    await query('DELETE FROM "Bots" WHERE id IN ($1, $2)', [bot1Id, bot2Id]);
    await query('DELETE FROM "Users" WHERE id = $1', [userId]);
    await pool.end();
  }
}

runTest().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('TEST FAILED:', err);
  pool.end();
  process.exit(1);
});
