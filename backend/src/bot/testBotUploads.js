const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { File } = require('node:buffer');
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(),'battlecode-bot-test-'));
process.env.BOT_STORAGE_ROOT = testRoot;

// Exercise real multipart parsing, file storage and restore behavior; isolate
// the database and Python compiler so this regression test needs no services.
require('node:child_process').execSync = () => Buffer.from('');
const records = [];
require('../config/db').query = async (sql,args = []) => {
  if (sql.includes('INSERT INTO "Bots"')) {
    const bot = {id:'test-bot',user_id:args[0],name:args[1],source_type:'file',
      file_path_or_git_url:args[2],source_code:args[3],status:'active',is_active:true,tactic:args[4]};
    records.push(bot);
    const {source_code,...publicBot} = bot;
    return {rows:[publicBot]};
  }
  return {rows:records};
};
require('../auth/auth.middleware').authenticateJWT = (req,res,next) => { req.user = {id:'user-test'}; next(); };
const express = require('express');
const app = express();
app.use('/api/bots',require('./bot.routes'));
app.use((error,req,res,next) => res.status(error.statusCode || 400).json({message:error.message}));
const {resolveBotPath,isBotAvailable} = require('./botStorage');
const service = require('./bot.service');
const {GameEngine} = require('../game/gameEngine');
const {playBotTurn} = require('../game/botDuel');

async function main() {
  const server = app.listen(0,'127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening',resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    const source = 'import json\nprint(json.dumps({"fromRow":0,"fromCol":0,"toRow":1,"toCol":0}))\n';
    const body = new FormData();
    body.append('name','My uploaded bot');
    body.append('file',new File([source],'MyBot.PY'));
    const response = await fetch(`${url}/api/bots/upload`,{method:'POST',body});
    const data = await response.json();
    assert.equal(response.status,201,JSON.stringify(data));
    assert.equal(records[0].source_code,source);
    assert.equal(fs.readFileSync(records[0].file_path_or_git_url,'utf8'),source);
    console.log('PASS: real multipart upload accepts .PY and backs up the submitted source unchanged');

    fs.unlinkSync(records[0].file_path_or_git_url);
    assert.ok(isBotAvailable(records[0]));
    const restored = resolveBotPath(records[0]);
    assert.equal(fs.readFileSync(restored,'utf8'),source);
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
    assert.ok(!('source_code' in (await service.getUserBots('user-test'))[0]));
    assert.ok(!('source_code' in (await service.getCommunityBots())[0]));
    console.log('PASS: legacy sample paths resolve; missing old uploads have an actionable error; lists do not leak source');
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections?.(); });
    if (path.dirname(testRoot) !== path.resolve(os.tmpdir()) || !path.basename(testRoot).startsWith('battlecode-bot-test-')) {
      throw new Error('Unexpected test cleanup path');
    }
    fs.rmSync(testRoot,{recursive:true,force:true});
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
