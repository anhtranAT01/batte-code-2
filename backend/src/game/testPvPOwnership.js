const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = fs.mkdtempSync(path.join(os.tmpdir(),'battlecode-pvp-test-'));
process.env.BOT_STORAGE_ROOT = root;
const me = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const unready = '33333333-3333-4333-8333-333333333333';
let actingUser = me;
const users = [{id:me,username:'Me',elo_rating:1200},{id:other,username:'Other',elo_rating:1200},
  {id:unready,username:'Unready',elo_rating:1200}];
const bots = [
  {id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',user_id:me,name:'My actual upload',is_active:true},
  {id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',user_id:other,name:'Their official upload',is_active:true},
  {id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',user_id:other,name:'Their reserve upload',is_active:false},
].map(bot => ({...bot,status:'active',source_type:'file',source_code:`# ${bot.name}\nprint('{}')`,
  file_path_or_git_url:'/lost/file.py'}));

require('../config/db').query = async (sql,args = []) => {
  if (sql.includes('LEFT JOIN LATERAL')) return {rows:users.map(user => {
    const bot = bots.find(b => b.user_id === user.id && b.is_active);
    return {...user,bot_id:bot?.id,bot_name:bot?.name,user_id:bot?.user_id,
      source_type:bot?.source_type,source_code:bot?.source_code,file_path_or_git_url:bot?.file_path_or_git_url};
  })};
  if (sql.includes('SELECT DISTINCT ON')) return {rows:bots.filter(b => args.includes(b.user_id) && b.is_active)};
  if (sql.includes('UPDATE "Bots" SET is_active = (id = $1)')) {
    const owned = bots.filter(b => b.user_id === args[1]);
    owned.forEach(bot => { bot.is_active = bot.id === args[0]; });
    return {rows:owned};
  }
  if (sql.includes('FROM "Bots"') && sql.includes('WHERE') && !sql.includes('COUNT')) {
    const bot = bots.find(b => b.id === args[0] && (!sql.includes('AND user_id = $2') || b.user_id === args[1]));
    return {rows:bot ? [{...bot,owner_id:bot.user_id,owner_name:users.find(u => u.id === bot.user_id).username}] : []};
  }
  return {rows:[]};
};
const {GameEngine} = require('./gameEngine');
const {GamePiece} = require('./piece');
const executed = new Set();
require('./pythonRunner').executePythonBot = async ({botScriptPath,inputPayload}) => {
  executed.add(path.basename(botScriptPath));
  assert.ok(fs.readFileSync(botScriptPath,'utf8').startsWith('# '));
  assert.ok(!('tactic' in inputPayload));
  const game = new GameEngine({size:inputPayload.board_size});
  game.grid = inputPayload.grid.map(row => row.map(cell => ({...cell,piece:cell.piece ? new GamePiece(cell.piece) : null})));
  return {success:true,move:game.getValidMovesForPlayer(inputPayload.player_id)[0],durationMs:1};
};
require('../auth/auth.middleware').authenticateJWT = (req,res,next) => {
  if (!actingUser) return res.status(401).json({success:false});
  req.user = {id:actingUser,username:users.find(u => u.id === actingUser)?.username};
  next();
};
const express = require('express');
const app = express();
app.use(express.json());
app.use('/api/game',require('./gameRoutes'));
app.use('/api/bots',require('../bot/bot.routes'));
app.use((error,req,res,next) => res.status(error.statusCode || 500).json({message:error.message}));

async function main() {
  const server = app.listen(0,'127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening',resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (url,body) => {
      const response = await fetch(base+url,body ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {});
      return {status:response.status,...await response.json()};
    };
    const list = await request('/api/bots/players');
    assert.equal(list.data.length,3);
    assert.equal(list.data.find(u => u.id === unready).bot,null);
    assert.equal(list.data.find(u => u.id === other).bot.id,bots[1].id);
    assert.ok(!JSON.stringify(list).includes('source_code'));
    console.log('PASS: people without ready bots stay listed; only official bot metadata is public');

    const match = await request('/api/game/pvp',{opponentUserId:other,boardSize:8});
    assert.equal(match.status,200,JSON.stringify(match));
    assert.equal(match.data.p1BotName,bots[0].name);
    assert.equal(match.data.p2BotName,bots[1].name);
    assert.deepEqual([...executed].sort(),[`${bots[0].id}.py`,`${bots[1].id}.py`].sort());
    assert.equal((await request('/api/game/pvp',{opponentUserId:other,bot2Id:bots[2].id})).status,400);
    assert.equal((await request('/api/game/bot-vs-bot',{bot2Id:bots[2].id})).status,400);
    assert.equal((await request(`/api/bots/${bots[2].id}/activate`,{})).status,404);
    assert.equal(bots[1].is_active,true);
    const originalSource = bots[0].source_code;
    const tacticChange = await fetch(`${base}/api/bots/${bots[0].id}/tactic`,{
      method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({tactic:'FLAG_RUSHER'}),
    });
    assert.equal(tacticChange.status,400);
    assert.equal(bots[0].source_code,originalSource);
    console.log('PASS: real PvP executes both owners\' selected uploads; challenger cannot replace or activate opponent bot');

    actingUser = other;
    assert.equal((await request(`/api/bots/${bots[2].id}/activate`,{})).status,200);
    assert.equal(bots[1].is_active,false);
    assert.equal(bots[2].is_active,true);
    actingUser = me;
    const next = await request('/api/game/pvp',{opponentUserId:other,boardSize:8});
    assert.equal(next.status,200);
    assert.equal(next.data.p2BotName,bots[2].name);
    assert.equal((await request('/api/game/pvp',{opponentUserId:unready})).status,422);
    assert.equal((await request('/api/game/pvp',{opponentUserId:me})).status,400);
    actingUser = null;
    assert.equal((await request('/api/game/pvp',{opponentUserId:other})).status,401);
    console.log('PASS: owner activation changes the next match; missing bot, self-play and unauthenticated PvP are rejected');
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections?.(); });
    if (path.dirname(root) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith('battlecode-pvp-test-')) throw new Error('Unsafe cleanup path');
    fs.rmSync(root,{recursive:true,force:true});
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
