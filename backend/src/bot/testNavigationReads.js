const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');
async function main(){
  if(!process.env.TEST_PGLITE_MODULE)throw new Error('Set TEST_PGLITE_MODULE; this test only uses an isolated database.');
  const {PGlite}=require(process.env.TEST_PGLITE_MODULE),db=new PGlite();
  const sql=async(text,args=[])=>args.length?db.query(text,args):(await db.exec(text)).at(-1)||{rows:[]};
  const dbPath=require.resolve('../config/db');
  let transferred=0,lastQuery='';
  require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{query:async(text,args)=>{lastQuery=text;const result=await sql(text,args);transferred=Buffer.byteLength(JSON.stringify(result.rows));return result;}}};
  try{
    await db.exec(`CREATE TABLE "Users"(id UUID PRIMARY KEY,username TEXT,elo_rating INT DEFAULT 1200);
      CREATE TABLE "Bots"(id UUID PRIMARY KEY,user_id UUID,name TEXT,source_type TEXT,file_path_or_git_url TEXT,
      source_code TEXT,status TEXT,error_count INT DEFAULT 0,is_active BOOLEAN DEFAULT false,tactic TEXT,created_at TIMESTAMPTZ DEFAULT NOW(),updated_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE "Matches"(id UUID PRIMARY KEY,player1_bot_id UUID,player2_bot_id UUID,winner_id UUID);`);
    const migration=fs.readFileSync(path.join(__dirname,'../scripts/navigationPerformance.sql'),'utf8');await db.exec(migration);await db.exec(migration);
    const owner=randomUUID(),other=randomUUID(),one=randomUUID(),two=randomUUID(),foreign=randomUUID();
    for(const id of [owner,other])await sql('INSERT INTO "Users"(id,username)VALUES($1,$2)',[id,id]);
    const source='# navigation fixture\n'.repeat(50_000);
    for(const [id,userId] of [[one,owner],[two,owner],[foreign,other]])await sql(`INSERT INTO "Bots"(id,user_id,name,source_type,file_path_or_git_url,source_code,status)VALUES($1,$2,'Fixture','file','/not-present.py',$3,'active')`,[id,userId,source]);
    await sql('INSERT INTO "Matches"(id,player1_bot_id,player2_bot_id,winner_id)VALUES($1,$2,$3,$4)',[randomUUID(),one,two,owner]);
    await sql('INSERT INTO "Matches"(id,player1_bot_id,player2_bot_id,winner_id)VALUES($1,$2,$2,NULL)',[randomUUID(),one]);
    const baseline=(await sql('SELECT * FROM "Bots" WHERE user_id=$1',[owner])).rows;
    const beforeBytes=Buffer.byteLength(JSON.stringify(baseline));
    const bots=await require('./bot.service').getUserBots(owner);
    assert.equal(bots.length,2);assert.ok(!bots.some(bot=>bot.id===foreign));
    const a=bots.find(bot=>bot.id===one),b=bots.find(bot=>bot.id===two);
    assert.equal(a.total_matches,2);assert.equal(a.matches_won,1);assert.equal(b.total_matches,1);assert.equal(b.matches_won,1);
    assert.ok(bots.every(bot=>bot.is_available && !('source_code' in bot) && !('has_source' in bot)));
    assert.ok(!/SELECT b\.\*/.test(lastQuery));assert.ok(transferred<2000);
    const listBytes=transferred;
    await sql('UPDATE "Bots" SET is_active=true WHERE id=$1',[one]);
    const players=await require('./bot.service').getPlayers();
    assert.equal(players.find(p=>p.id===owner).ready,true);
    assert.equal(players.find(p=>p.id===owner).bot.id,one);
    assert.equal(players.find(p=>p.id===other).ready,false);
    assert.ok(transferred<2000);assert.ok(players.every(p=>!('source_code' in p)));
    console.log(`PASS: isolated PostgreSQL bot/player lists preserve ownership, same-bot counts, wins and availability without source transfer: ${beforeBytes} -> ${listBytes} bytes.`);
  }finally{await db.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
