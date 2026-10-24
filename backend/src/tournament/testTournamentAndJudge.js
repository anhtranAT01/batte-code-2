/**
 * Automated Verification Script for Judge Worker, Infinite Loop Kill & Tournament System
 */

const path = require('path');
const { executePythonBot } = require('../../../judge-worker/src/runner/pythonRunner');
const { generateSwissPairings } = require('./swissPairing');
const { generateTournamentExcel, generateTournamentCSV } = require('./tournamentExport');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

async function runTests() {
  console.log('--- STARTING TOURNAMENT & JUDGE WORKER VERIFICATION ---');

  // Test 1: Python Runner with normal student bot
  console.log('\n[Test 1] Testing Student Template Bot Execution');
  const templateBotPath = path.resolve(__dirname, '../../../sample-bots/student_bot_template.py');
  const sampleGameState = {
    player_id: 1,
    turn_number: 1,
    grid: [
      [{ piece: { player: 1, type: 'ROCK' } }, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, { piece: { player: 2, type: 'SCISSORS' } }],
    ],
  };

  const normalRes = await executePythonBot({
    botScriptPath: templateBotPath,
    inputPayload: sampleGameState,
    timeoutMs: 1500,
  });

  assert(normalRes.success === true, 'Student template bot executed successfully');
  assert(normalRes.move !== undefined, `Bot outputted move: ${JSON.stringify(normalRes.move)}`);
  assert(normalRes.timedOut === false, 'Bot completed before timeout');

  // Test 2: Python Runner Timeout & Kill Protection on Infinite Loop Bot
  console.log('\n[Test 2] Testing Infinite Loop Bot Kill & Timeout Guard');
  const loopBotPath = path.resolve(__dirname, '../../../sample-bots/test_infinite_loop_bot.py');

  const startLoopTime = Date.now();
  const loopRes = await executePythonBot({
    botScriptPath: loopBotPath,
    inputPayload: sampleGameState,
    timeoutMs: 1000, // 1.0 second timeout limit
  });
  const loopElapsed = Date.now() - startLoopTime;

  assert(loopRes.success === false, 'Infinite loop bot was correctly detected and stopped');
  assert(loopRes.timedOut === true, 'Timed out flag is TRUE');
  assert(loopRes.hasInfiniteLoop === true, 'hasInfiniteLoop flag is TRUE');
  assert(loopElapsed >= 900 && loopElapsed <= 2000, `Process was terminated promptly (${loopElapsed}ms)`);
  console.log(`Detailed error message: "${loopRes.error}"`);

  // Test 3: Swiss-system Pairing for 1000 Participants
  console.log('\n[Test 3] Testing Swiss Pairing Scale (1000 participants)');
  const participants1000 = [];
  for (let i = 1; i <= 1000; i++) {
    participants1000.push({
      id: `user_${i}`,
      userId: `user_${i}`,
      username: `student_${i}`,
      elo: 1000 + Math.floor(Math.random() * 800),
      points: Math.floor(Math.random() * 5),
    });
  }

  const { pairings, bye } = generateSwissPairings(participants1000, []);
  assert(pairings.length === 500, `Generated exactly 500 pairings for 1000 participants`);
  assert(bye === null, 'No bye needed for even participant count');

  // Test 4: Excel (.xlsx) and CSV Report Generation
  console.log('\n[Test 4] Testing Excel & CSV Report Generation');
  const mockTournament = {
    id: 'tourney_1',
    name: 'Giải Đấu Cờ Chiến Thuật THPT Toàn Quốc 2026',
    status: 'COMPLETED',
  };

  const mockStandings = [
    {
      userId: 'u1',
      username: 'pro_student_01',
      botName: 'DeepScissors_v3',
      points: 7,
      elo: 1650,
      eloDelta: 85,
      matchesPlayed: 7,
      wins: 7,
      losses: 0,
      draws: 0,
      winRate: 100,
      avgWinDurationMs: 420,
      avgTurns: 24,
      infiniteLoopErrors: 0,
      botStatus: 'active',
    },
    {
      userId: 'u2',
      username: 'faulty_student_02',
      botName: 'BrokenWhileTrue_AI',
      points: 1,
      elo: 1120,
      eloDelta: -45,
      matchesPlayed: 7,
      wins: 1,
      losses: 6,
      draws: 0,
      winRate: 14,
      avgWinDurationMs: 1200,
      avgTurns: 8,
      infiniteLoopErrors: 4, // 4 infinite loop penalties
      botStatus: 'error',
    },
  ];

  const excelBuffer = await generateTournamentExcel(mockTournament, mockStandings);
  assert(Buffer.isBuffer(excelBuffer) && excelBuffer.length > 1000, `Excel file generated (${excelBuffer.length} bytes)`);

  const csvString = generateTournamentCSV(mockTournament, mockStandings);
  assert(csvString.includes('BÁO CÁO GIẢI ĐẤU'), 'CSV contains title');
  assert(csvString.includes('pro_student_01'), 'CSV contains participant username');
  assert(csvString.includes('BrokenWhileTrue_AI'), 'CSV contains bot name with loop errors');

  console.log('\n🎉 ALL TOURNAMENT & JUDGE WORKER TESTS PASSED 100%!');
}

runTests();
