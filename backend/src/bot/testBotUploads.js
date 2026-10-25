const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { File } = require('node:buffer');
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(),'battlecode-bot-test-'));
process.env.BOT_STORAGE_ROOT = testRoot;

// Real multipart upload -> real Python validation -> storage -> real PvP.
// Only the database/authentication are isolated; run with PYTHON_EXECUTABLE if needed.
const records = [];
const firstUser = '11111111-1111-4111-8111-111111111111';
const secondUser = '22222222-2222-4222-8222-222222222222';
let actingUser = firstUser;
require('../config/db').query = async (sql,args = []) => {
  if (sql.includes('INSERT INTO "Bots"')) {
    const bot = {id:require('crypto').randomUUID(),user_id:args[0],name:args[1],source_type:'file',
      file_path_or_git_url:args[2],source_code:args[3],status:'active',is_active:true,tactic:args[4]};
    records.push(bot);
    const {source_code,...publicBot} = bot;
    return {rows:[publicBot]};
  }
  if (sql.includes('SELECT DISTINCT ON')) return {rows:records.filter(bot => args.includes(bot.user_id) && bot.is_active)};
  if (sql.includes('WHERE id = $1')) return {rows:records.filter(bot => bot.id === args[0] && (!sql.includes('AND user_id') || bot.user_id === args[1]))};
  if (sql.includes('WHERE b.id = $1')) return {rows:records.filter(bot => bot.id === args[0]).map(bot => ({...bot,owner_id:bot.user_id,owner_name:'Other player'}))};
  if (sql.includes('INSERT INTO "Matches"') || sql.includes('UPDATE "Users"')) return {rows:[]};
  return {rows:records};
};
require('../auth/auth.middleware').authenticateJWT = (req,res,next) => { req.user = {id:actingUser}; next(); };
const express = require('express');
const app = express();
app.use('/api/bots',require('./bot.routes'));
app.use((error,req,res,next) => res.status(error.statusCode || 400).json({message:error.message}));
const {resolveBotPath,isBotAvailable} = require('./botStorage');
const service = require('./bot.service');
const {GameEngine} = require('../game/gameEngine');
const {playBotTurn} = require('../game/botDuel');
const {runPvPDuel} = require('../game/gameService');

async function main() {
  const server = app.listen(0,'127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening',resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    const source = fs.readFileSync(path.join(__dirname,'../../../sample-bots/heuristic.py'),'utf8');
    const body = new FormData();
    body.append('name','My uploaded bot');
    body.append('file',new File([source],'MyBot.PY'));
    const response = await fetch(`${url}/api/bots/upload`,{method:'POST',body});
    const data = await response.json();
    assert.equal(response.status,201,JSON.stringify(data));
    assert.equal(records[0].source_code,source);
    assert.equal(fs.readFileSync(records[0].file_path_or_git_url,'utf8'),source);
    console.log('PASS: real multipart upload accepts .PY and backs up the submitted source unchanged');

    for (const [code,status,pattern] of [
      ['',400,/rỗng/],
      ['# comments only\n',422,/EMPTY_OUTPUT/],
      ['def choose_move(state):\n    return {}\n',422,/EMPTY_OUTPUT/],
      ['print("{}")\n',422,/INVALID_MOVE/],
      ['def broken(:\n',400,/SyntaxError/],
    ]) {
      const invalidBody = new FormData();
      invalidBody.append('name','Invalid bot');
      invalidBody.append('file',new File([code],'invalid.py'));
      const rejected = await fetch(`${url}/api/bots/upload`,{method:'POST',body:invalidBody});
      const rejectedData = await rejected.json();
      assert.equal(rejected.status,status,JSON.stringify(rejectedData));
      assert.match(rejectedData.message,pattern);
      assert.equal(records.length,1,'Invalid source must never become a saved/official bot');
    }
    console.log('PASS: blank files, missing entrypoints, invalid output and syntax errors are rejected at upload');

    fs.unlinkSync(records[0].file_path_or_git_url);
    assert.ok(isBotAvailable(records[0]));
    const restored = resolveBotPath(records[0]);
    assert.equal(fs.readFileSync(restored,'utf8'),source);
    fs.writeFileSync(restored,'');
    assert.equal(fs.readFileSync(resolveBotPath(records[0]),'utf8'),source,'An empty disk file cannot override saved source');
    const game = new GameEngine();
    const selectedMove = game.getValidMovesForPlayer(1)[0];
    await playBotTurn(game,{name:records[0].name,scriptPath:restored},async args => {
      assert.equal(args.botScriptPath,restored);
      assert.equal(fs.readFileSync(args.botScriptPath,'utf8'),source);
      return {success:true,move:selectedMove,durationMs:5};
    });
    assert.equal(game.turnCount,1);
    assert.equal(game.replay[0].botDecision.algorithm,'PYTHON');
    console.log('PASS: lost file restores from saved source and the selected upload plays a real turn');

    const bundled = {file_path_or_git_url:'C:\\old-checkout\\sample-bots\\student_bot_template.py'};
    assert.ok(fs.existsSync(resolveBotPath(bundled)));
    assert.throws(() => resolveBotPath({name:'Legacy missing',user_id:'test',source_type:'file',
      file_path_or_git_url:'/missing/bot.py'}),/đã được chọn nhưng file không còn/);
    assert.ok(!('source_code' in (await service.getUserBots(firstUser))[0]));
    assert.ok(!('source_code' in (await service.getCommunityBots())[0]));
    console.log('PASS: legacy sample paths resolve; missing old uploads have an actionable error; lists do not leak source');

    actingUser = secondUser;
    const secondBody = new FormData();
    secondBody.append('name','Other uploaded heuristic');
    secondBody.append('file',new File([source],'bot.py'));
    const secondResponse = await fetch(`${url}/api/bots/upload`,{method:'POST',body:secondBody});
    assert.equal(secondResponse.status,201,await secondResponse.text());
    const duel = await runPvPDuel({userId:firstUser,userName:'First player',opponentUserId:secondUser,boardSize:9});
    assert.equal(duel.p1BotName,'My uploaded bot');
    assert.equal(duel.p2BotName,'Other uploaded heuristic');
    assert.ok(duel.totalTurns > 1);
    assert.ok(duel.replay.steps.every(step => step.botDecision.algorithm === 'PYTHON' && !step.warning));
    console.log('PASS: two uploaded heuristic.py files complete real Python PvP with no empty output or fallback moves');
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections?.(); });
    if (path.dirname(testRoot) !== path.resolve(os.tmpdir()) || !path.basename(testRoot).startsWith('battlecode-bot-test-')) {
      throw new Error('Unexpected test cleanup path');
    }
    fs.rmSync(testRoot,{recursive:true,force:true});
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
