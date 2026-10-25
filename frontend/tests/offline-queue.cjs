const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const output=buildSync({entryPoints:[require('path').resolve(__dirname,'../src/lib/outbox.js')],bundle:true,platform:'node',format:'cjs',write:false});
const moduleUnderTest={exports:{}};new Function('module','exports',output.outputFiles[0].text)(moduleUnderTest,moduleUnderTest.exports);
const {createOutbox}=moduleUnderTest.exports;
async function main(){
  const rows=new Map();let clock=0,number=0,lost=true,session={userId:'one',token:'token-one'},posts=[];
  const received=new Map();
  const store={put:async row=>rows.set(row.id,structuredClone(row)),list:async()=>[...rows.values()].map(x=>structuredClone(x)),remove:async id=>rows.delete(id)};
  const queue=createOutbox({store,now:()=>clock,uuid:()=>String(++number),fetcher:async(url,init)=>{
    if(url.includes('/me'))return {ok:true,json:async()=>({data:{id:session.userId}})};
    const body=JSON.parse(init.body);posts.push({body,token:init.headers.Authorization});
    if(!received.has(body.id))received.set(body.id,{id:body.id,status:'pending'});
    if(lost){lost=false;throw new Error('Response lost after commit');}
    return {ok:true,status:202,json:async()=>({success:true,data:received.get(body.id)})};
  }});
  const original=await queue.enqueue('one','bot',{name:'Bot',source:'print(1)'});
  await queue.flush(()=>session);
  assert.equal((await queue.list('one'))[0].state,'queued');assert.equal(received.size,1);
  clock=100000;await queue.flush(()=>session);
  assert.equal((await queue.list('one'))[0].state,'received');assert.equal(received.size,1);assert.equal(posts[0].body.id,posts[1].body.id);
  console.log('PASS: lost response retains the original ID and retries without duplicate server receipt');
  await queue.enqueue('one','bot',{name:'Private',source:'old account code'});
  session={userId:'two',token:'token-two'};clock+=100000;const before=posts.length;
  await queue.flush(()=>session);assert.equal(posts.length,before);assert.equal((await queue.list('two')).length,0);
  console.log('PASS: switching accounts never sends another account’s queue');
  const bad=createOutbox({store:{...store,put:async()=>{throw new Error('Quota exceeded');}},uuid:()=>String(++number)});
  await assert.rejects(bad.enqueue('two','bot',{source:'code'}),/Quota/);
  console.log('PASS: failed durable storage is reported, never claimed saved');
  const rejected=createOutbox({store,now:()=>clock,uuid:()=>String(++number),fetcher:async url=>url.includes('/me')?{ok:true,json:async()=>({data:{id:'two'}})}:{ok:false,status:422,json:async()=>({message:'Invalid source'})}});
  const item=await rejected.enqueue('two','bot',{source:'bad'});await rejected.flush(()=>session);assert.equal((await rejected.list('two'))[0].state,'rejected');
  await rejected.retry(item.id,'one');assert.equal((await rejected.list('two'))[0].state,'rejected');
  await rejected.retry(item.id,'two');assert.equal((await rejected.list('two'))[0].state,'queued');
  console.log('PASS: terminal errors stop automatic retries; only the owner may retry');
  const noAuth=createOutbox({store,now:()=>clock,fetcher:async()=>({ok:false,status:401})});await noAuth.flush(()=>session);assert.equal((await rejected.list('two'))[0].state,'queued');
  assert.equal(original.payload.source,'print(1)');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
