const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const {create,act} = require('react-test-renderer');
const {transformSync} = require('esbuild');
const cache = new Map();
function load(filename) {
  if (cache.has(filename)) return cache.get(filename);
  const module = {exports:{}};
  const js = transformSync(fs.readFileSync(filename,'utf8'),{loader:filename.endsWith('.jsx') ? 'jsx' : 'js',format:'cjs'}).code;
  new Function('require','module','exports',js)(id => {
    if (id === '../context/AuthContext') return {useAuth:() => ({user:null,getAuthHeaders:() => ({})})};
    if (id === './GameBoard') return {__esModule:true,default:() => React.createElement('div',{'data-board':true})};
    if (id.startsWith('../lib/')) return load(path.resolve(path.dirname(filename),id+'.js'));
    return require(id);
  },module,module.exports);
  cache.set(filename,module.exports);
  return module.exports;
}
const {runDuel,applyDuelEvent} = load(path.resolve(__dirname,'../src/lib/duelStream.js'));
const encode = event => new TextEncoder().encode(JSON.stringify(event)+'\n');
const initial = {type:'started',data:{p1Name:'Bạn',p2Name:'Máy',replay:{initialBoard:[[{piece:null}]],steps:[]}}};
const step = {move:{fromRow:0,fromCol:0,toRow:1,toCol:0},player:1,step:1,boardSnapshot:[]};
const finished = {winner:1,winnerName:'Bạn',totalTurns:1,replay:{steps:[step]}};
const tick = () => new Promise(resolve => setImmediate(resolve));
const text = node => Array.isArray(node) ? node.map(text).join('')
  : node && typeof node === 'object' ? text(node.children || node.props?.children) : String(node ?? '');

async function main() {
  let sender,posted,events = [];
  global.fetch = async (url,options) => {
    posted = options;
    return new Response(new ReadableStream({start(controller){sender=controller;}}),
      {headers:{'Content-Type':'application/x-ndjson'}});
  };
  let complete = false;
  const pending = runDuel('/api/game/bot-vs-bot',{body:{bot1Id:'template_alphabeta'},onUpdate:e => events.push(e)})
    .then(result => {complete=true;return result;});
  await tick();
  const bytes = encode(initial);
  // Split in the middle of Vietnamese UTF-8 and JSON; one network read is not one event.
  for (let i=0;i<bytes.length;i+=3) sender.enqueue(bytes.slice(i,i+3));
  await tick();
  assert.equal(events[0].data.p1Name,'Bạn');
  assert.equal(complete,false,'Initial board arrives while the match is still running');
  sender.enqueue(encode({type:'steps',data:{steps:[step],totalTurns:1}}));
  sender.enqueue(encode({type:'heartbeat'}));
  sender.enqueue(encode({type:'completed',data:finished}));
  sender.close();
  assert.deepEqual(await pending,finished);
  assert.equal(events.length,2);
  assert.equal(posted.headers.Accept,'application/x-ndjson');
  let state = applyDuelEvent(null,events[0]);
  state = applyDuelEvent(state,events[1]);
  assert.equal(state.replay.steps.length,1);

  global.fetch = async () => new Response(encode({type:'error',message:'Bot không hợp lệ'}),
    {headers:{'Content-Type':'application/x-ndjson'}});
  await assert.rejects(runDuel('/',{body:{}}),/Bot không hợp lệ/);
  global.fetch = async () => new Response('',{headers:{'Content-Type':'application/x-ndjson'}});
  await assert.rejects(runDuel('/',{body:{}}),/gián đoạn/);
  global.fetch = async () => new Response(JSON.stringify({success:true,data:finished}),
    {headers:{'Content-Type':'application/json'}});
  assert.deepEqual(await runDuel('/',{body:{}}),finished);
  console.log('PASS: incremental UTF-8 stream, real progress, completion, bot errors, interrupted stream and legacy JSON');

  const Boss = load(path.resolve(__dirname,'../src/components/BossArenaView.jsx')).default;
  let signal;
  global.fetch = async (url,options) => {
    signal = options.signal;
    return new Response(new ReadableStream({start(controller){
      sender=controller;
      signal.addEventListener('abort',() => controller.error(new DOMException('Aborted','AbortError')),{once:true});
    }}),{headers:{'Content-Type':'application/x-ndjson'}});
  };
  let tree,running;
  await act(async () => {tree=create(React.createElement(Boss));});
  await act(async () => {
    running=tree.root.findAllByType('button').find(n => text(n.props.children).includes('Khởi Tranh Tự Động')).props.onClick();
    await tick(); sender.enqueue(encode(initial)); await tick();
  });
  assert.equal(tree.root.findAllByProps({'data-board':true}).length,1,'Board visible before final response');
  assert.match(text(tree.toJSON()),/Bot đang tính tiếp/);
  assert.ok(!text(tree.toJSON()).includes('BOSS ĐÃ CHIẾN THẮNG'),'No premature result during buffering');
  await act(async () => {
    tree.root.findAllByType('button').find(n => text(n.props.children).includes('Chọn Boss')).props.onClick();
    await running;
  });
  assert.equal(signal.aborted,true);
  assert.equal(tree.root.findAllByProps({'data-board':true}).length,0);
  assert.equal(tree.root.findAllByProps({role:'alert'}).length,0,'Intentional cancellation has no error banner');
  act(() => tree.unmount());
  console.log('PASS: board renders before match completion, buffers without false winner, and leaving cancels the request');
}
main().catch(error => {console.error(error);process.exitCode=1;});
