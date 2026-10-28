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
  const sendSteps=async(count)=>{
    sender.enqueue(encode({type:'steps',data:{steps:Array.from({length:count},(_,i)=>({...step,step:i+1})),totalTurns:count}}));
    await tick();
  };
  await act(async()=>sendSteps(8));
  const seek=()=>tree.root.findByProps({type:'range'});
  assert.equal(seek().props.value,7,'Live follows the newest batch immediately without playback lag');
  await act(async()=>tree.root.findAllByType('button').find(n=>text(n.props.children).includes('Tạm dừng xem')).props.onClick());
  await act(async()=>sendSteps(4));
  assert.equal(seek().props.value,7,'Pausing freezes the view while the server continues');
  await act(async()=>tree.root.findAllByType('button').find(n=>text(n.props.children).includes('Về trực tiếp')).props.onClick());
  assert.equal(seek().props.value,11,'Return to live jumps to the latest snapshot');
  await act(async()=>seek().props.onChange({target:{value:'2'}}));
  await act(async()=>sendSteps(2));
  assert.equal(seek().props.value,2,'Manual seek stays put during incoming progress');
  await act(async () => {
    tree.root.findAllByType('button').find(n => text(n.props.children).includes('Chọn Boss')).props.onClick();
    await running;
  });
  assert.equal(signal.aborted,true);
  assert.equal(tree.root.findAllByProps({'data-board':true}).length,0);
  assert.equal(tree.root.findAllByProps({role:'alert'}).length,0,'Intentional cancellation has no error banner');
  act(() => tree.unmount());
  console.log('PASS: board renders before completion, live follows newest snapshots, pause/seek/return-live work while streaming, and leaving cancels the request');

  const {useLivePlayback}=load(path.resolve(__dirname,'../src/lib/useLivePlayback.js'));
  let playback;
  function PlaybackHarness(props){playback=useLivePlayback(props);return null;}
  await act(async()=>{tree=create(React.createElement(PlaybackHarness,{totalSteps:20,loading:true,active:true}));});
  assert.equal(playback.currentStepIdx,19);
  await act(async()=>playback.setCurrentStepIdx(index=>index-1));
  assert.equal(playback.currentStepIdx,18,'Single-step controls start at the visible live index');
  await act(async()=>playback.returnToLive());
  await act(async()=>tree.update(React.createElement(PlaybackHarness,{totalSteps:30,loading:false,active:true})));
  assert.equal(playback.currentStepIdx,29,'Completion shows the final board immediately');
  assert.equal(playback.isPlaying,false);
  await act(async()=>playback.togglePlayback());
  assert.equal(playback.currentStepIdx,0,'Completed match only replays when explicitly requested');
  assert.equal(playback.isPlaying,true);
  await act(async()=>playback.resetPlayback());
  await act(async()=>tree.update(React.createElement(PlaybackHarness,{totalSteps:0,loading:true,active:true})));
  assert.equal(playback.currentStepIdx,0);
  assert.equal(playback.followLive,true,'A new match resets to live following');
  await act(async()=>tree.unmount());
  console.log('PASS: shared Boss/PvP playback steps from visible live position, shows final board, replays explicitly and resets for a new match');

  const Boundary = load(path.resolve(__dirname,'../src/components/ViewBoundary.jsx')).default;
  const unavailableView = () => { throw new Error('Failed to fetch dynamically imported module'); };
  const originalConsoleError = console.error;
  try {
    console.error = () => {};
    await act(async () => { tree = create(React.createElement(Boundary, { key:'failed' }, React.createElement(unavailableView))); });
  } finally { console.error = originalConsoleError; }
  assert.equal(tree.root.findAllByProps({role:'alert'}).length,1);
  assert.match(text(tree.toJSON()),/Tải lại ứng dụng/);
  await act(async () => { tree.update(React.createElement(Boundary,{key:'another-tab'},React.createElement('p',null,'Healthy view'))); });
  assert.match(text(tree.toJSON()),/Healthy view/);
  act(() => tree.unmount());
  console.log('PASS: an unavailable screen has a recovery action and does not prevent opening another tab');
}
main().catch(error => {console.error(error);process.exitCode=1;});
