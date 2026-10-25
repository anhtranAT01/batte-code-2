const assert = require('node:assert/strict');
const db = require('../config/db');
db.prisma = null;
const writes = [];
let checks = 0;
db.query = async (sql,args) => {
  checks++;
  if (!sql.includes('INSERT')) return {rows:[]};
  writes.push(args);
  return {rows:[{id:'11111111-1111-4111-8111-111111111111',username:args[0],role:args[2],elo_rating:1200}]};
};
const express = require('express');
const app = express();
app.use(express.json());
app.use('/api/auth',require('./auth.routes'));
app.use((error,req,res,next) => res.status(500).json({message:error.message}));

async function main() {
  const server = app.listen(0,'127.0.0.1');
  const originalSecret = process.env.ADMIN_REGISTRATION_SECRET;
  try {
    await new Promise(resolve => server.once('listening',resolve));
    const register = async body => {
      const result = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/register`,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'test_user',password:'test_password',...body}),
      });
      return {status:result.status,...await result.json()};
    };
    delete process.env.ADMIN_REGISTRATION_SECRET;
    assert.equal((await register({role:'ADMIN',adminRegistrationSecret:'anything'})).status,403);
    process.env.ADMIN_REGISTRATION_SECRET = 'test-only-server-secret';
    assert.equal((await register({role:'ADMIN'})).status,403);
    assert.equal((await register({role:'ADMIN',adminRegistrationSecret:'wrong'})).status,403);
    assert.equal(checks,0,'Rejected admin requests cannot write or check usernames');
    const admin = await register({role:'ADMIN',adminRegistrationSecret:'test-only-server-secret'});
    assert.equal(admin.status,201);
    assert.equal(admin.data.user.role,'ADMIN');
    assert.ok(!JSON.stringify(admin).includes('test-only-server-secret'));
    assert.ok(!JSON.stringify(writes).includes('test-only-server-secret'));
    assert.equal((await register({role:'STUDENT'})).status,201);
    assert.equal((await register({role:'TEACHER'})).status,201);
    assert.equal((await register({role:'admin'})).status,400);
    console.log('PASS: direct API admin signup requires configured correct secret; no secret is stored/returned; normal signup still works');
  } finally {
    if (originalSecret === undefined) delete process.env.ADMIN_REGISTRATION_SECRET;
    else process.env.ADMIN_REGISTRATION_SECRET = originalSecret;
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections?.(); });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
