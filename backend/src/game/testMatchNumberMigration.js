// Uses only an isolated transaction/schema, never commits or alters public data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const {Pool} = require('pg');

async function main() {
  if (!process.env.TEST_DATABASE_URL && !process.env.TEST_PGLITE_MODULE) {
    console.log('SKIP: set TEST_DATABASE_URL or TEST_PGLITE_MODULE to verify migration in an isolated database');
    return;
  }
  let pool;
  if (process.env.TEST_PGLITE_MODULE) {
    const {PGlite} = require(process.env.TEST_PGLITE_MODULE);
    const db = new PGlite();
    pool = {connect:async()=>({query:async(sql,args)=>{
      if (args?.length) return db.query(sql,args);
      return (await db.exec(sql)).at(-1) || {rows:[]};
    },release(){}}),end:()=>db.close()};
  } else {
    const url = new URL(process.env.TEST_DATABASE_URL);
    const ssl = url.hostname.endsWith('.supabase.com') || url.searchParams.has('sslmode');
    url.searchParams.delete('sslmode');url.searchParams.delete('uselibpqcompat');
    pool = new Pool({connectionString:url.toString(),...(ssl ? {ssl:{rejectUnauthorized:false}} : {}),max:1,connectionTimeoutMillis:5000});
  }
  let client;
  try { client=await pool.connect(); } catch(error) {await pool.end();throw error;}
  const schema = 'test_match_numbers_'+randomUUID().replaceAll('-','');
  const migration = fs.readFileSync(path.join(__dirname,'../scripts/matchNumbers.sql'),'utf8')
    .replace(/^BEGIN;\s*$/m,'').replace(/^COMMIT;\s*$/m,'');
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET LOCAL search_path TO ${schema}`);
    await client.query('CREATE TABLE "Matches" (id UUID PRIMARY KEY,created_at TIMESTAMPTZ NOT NULL)');
    const early=randomUUID(),late=randomUUID();
    await client.query('INSERT INTO "Matches" VALUES ($1,\'2025-01-02\'),($2,\'2025-01-01\')',[late,early]);
    await client.query(migration);
    assert.deepEqual((await client.query('SELECT id,match_number FROM "Matches" ORDER BY match_number')).rows.map(row=>({...row,match_number:String(row.match_number)})),
      [{id:early,match_number:'1'},{id:late,match_number:'2'}]);
    const inserted=await client.query('INSERT INTO "Matches" (id,created_at) VALUES ($1,NOW()) RETURNING match_number',[randomUUID()]);
    assert.equal(String(inserted.rows[0].match_number),'3');
    await client.query('DELETE FROM "Matches" WHERE match_number=2');
    await client.query(migration);
    assert.equal(String((await client.query('INSERT INTO "Matches" (id,created_at) VALUES ($1,NOW()) RETURNING match_number',[randomUUID()])).rows[0].match_number),'4');
    await client.query('DELETE FROM "Matches"');
    await client.query(migration);
    assert.equal(String((await client.query('INSERT INTO "Matches" (id,created_at) VALUES ($1,NOW()) RETURNING match_number',[randomUUID()])).rows[0].match_number),'5');
    console.log('PASS: chronological backfill, UUID preservation, idempotence, sequence allocation and no number reuse after deletion');
  } finally {
    await client.query('ROLLBACK');
    client.release();await pool.end();
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
