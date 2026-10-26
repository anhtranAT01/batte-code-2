// Actual delayed child processes and simultaneous HTTP requests; no remote Git/DB.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const express=require('express'),children=require('node:child_process');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'battlecode-async-test-'));
process.env.BOT_STORAGE_ROOT=temp;
const original=children.execFile;
let started,spawned;
children.execFile=(command,args,options,callback)=>{
  spawned={command,args,options};started?.();
  return original(process.execPath,['-e',command==='git'?"setTimeout(()=>{console.error('fixture git failure');process.exit(1)},350)":"setTimeout(()=>{},350)"],{windowsHide:true},callback);
};
const dbPath=require.resolve('../config/db');
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{query:async()=>({rows:[]})}};
const service=require('./bot.service');
async function main(){
  const app=express();
  app.get('/ping',(req,res)=>res.json({ok:true}));
  app.post('/compile',async(req,res)=>res.json(await service.validatePythonSyntax('fixture.py')));
  app.post('/git',async(req,res)=>{try{await service.saveGitBot({userId:'fixture',gitUrl:'https://fixture.invalid/repo.git'});res.json({ok:true});}catch(error){res.status(400).json({message:error.message});}});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`,metrics=[];
  try{
    for(const route of ['compile','git']){
      let finished=false,resolveStarted;const signal=new Promise(resolve=>resolveStarted=resolve);started=resolveStarted;
      const start=performance.now();const work=fetch(`${base}/${route}`,{method:'POST'}).then(async res=>{finished=true;return {status:res.status,data:await res.json()};});
      await signal;
      const pingStart=performance.now();assert.equal((await fetch(`${base}/ping`)).status,200);
      assert.equal(finished,false,'Another HTTP request must finish while the child is still running');
      const pingMs=Math.round(performance.now()-pingStart),result=await work;
      if(route==='compile')assert.equal(result.data.valid,true);
      else{assert.equal(result.status,400);assert.equal(spawned.command,'git');assert.equal(spawned.args[3],'--');assert.equal(spawned.options.windowsHide,true);assert.equal(spawned.options.env.GIT_TERMINAL_PROMPT,'0');}
      metrics.push({route,pingMs,operationMs:Math.round(performance.now()-start)});
    }
    console.log('PASS: syntax validation/Git clone yield to simultaneous HTTP requests and pass structured command arguments.');console.log(JSON.stringify(metrics));
  }finally{children.execFile=original;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    assert.equal(path.dirname(path.resolve(temp)),path.resolve(os.tmpdir()));assert.ok(path.basename(temp).startsWith('battlecode-async-test-'));
    await fs.promises.rm(temp,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
