const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const React=require('react'),{act,create}=require('react-test-renderer'),{transformSync}=require('esbuild');
function read(name,requireFor=require){const m={exports:{}};new Function('require','module','exports',transformSync(fs.readFileSync(path.resolve(__dirname,'../src',name),'utf8'),{loader:name.endsWith('.jsx')?'jsx':'js',format:'cjs',define:{'import.meta.env':'{}'}}).code)(requireFor,m,m.exports);return m.exports;}
const screen=read('lib/screenData.js'),deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const result=data=>({ok:true,json:async()=>({success:true,data})});
async function main(){
  let count=0,slow=deferred();global.fetch=async()=>{count++;return slow.promise;};
  const one=screen.readScreenData('/api/bots/players'),two=screen.readScreenData('/api/bots/players');
  slow.resolve(result([{id:'one'}]));assert.deepEqual(await one,await two);assert.equal(count,1);
  await screen.readScreenData('/api/bots/players');assert.equal(count,1);
  const realNow=Date.now;try{Date.now=()=>realNow()+6000;assert.deepEqual(screen.peekScreenData('/api/bots/players'),[{id:'one'}]);await screen.readScreenData('/api/bots/players');assert.equal(count,2);}finally{Date.now=realNow;}
  screen.invalidateScreenData();let privateCalls=0;
  global.fetch=async(url,init)=>{privateCalls++;return result([init.headers.Authorization]);};
  await screen.readScreenData('/api/bots/my-bots',{headers:{Authorization:'Bearer first'}});
  assert.equal(screen.peekScreenData('/api/bots/my-bots',{Authorization:'Bearer second'}),undefined);
  await screen.readScreenData('/api/bots/my-bots',{headers:{Authorization:'Bearer second'}});assert.equal(privateCalls,2);
  screen.invalidateScreenData();slow=deferred();global.fetch=()=>slow.promise;
  const cancel=new AbortController(),aborted=screen.readScreenData('/api/bots/players',{signal:cancel.signal});
  const other=screen.readScreenData('/api/bots/players');cancel.abort();await assert.rejects(aborted,e=>e.name==='AbortError');
  slow.resolve(result(['shared']));assert.deepEqual(await other,['shared']);
  screen.invalidateScreenData();slow=deferred();global.fetch=()=>slow.promise;
  const stale=screen.readScreenData('/api/bots/players');
  global.fetch=async()=>result(['fresh']);await screen.readScreenData('/api/bots/players',{force:true});
  slow.resolve(result(['stale']));await stale;assert.deepEqual(screen.peekScreenData('/api/bots/players'),['fresh']);
  screen.invalidateScreenData();global.fetch=()=>new Promise(()=>{});
  await assert.rejects(screen.readScreenData('/api/bots/players',{timeoutMs:15}),/phản hồi chậm/);
  global.fetch=async()=>result(['retry']);assert.deepEqual(await screen.readScreenData('/api/bots/players'),['retry']);
  global.window={location:{origin:'https://fixture.test',port:'',hostname:'fixture.test',hash:'',search:''},fetch:async()=>result([])};
  const api=read('lib/api.js',id=>id==='./screenData'?screen:require(id));api.installApiFetch();
  await window.fetch('/api/bots/activate',{method:'POST'});assert.equal(screen.peekScreenData('/api/bots/players'),undefined);
  console.log('PASS: navigation reads deduplicate, revalidate stale snapshots, isolate credentials, retain shared reads on consumer abort, guard forced-refresh races, time out and clear after mutations.');

  const renders={leaderboard:0,pvp:0},events={};let warmups=0,cancellations=0;
  const auth={getAuthHeaders:()=>({})},toggle=()=>{};
  const page=name=>function Page(){renders[name]=(renders[name]||0)+1;return React.createElement('p',null,name);};
  const modules=Object.fromEntries(['pvp','boss','tournament','rules','bots','database','replay','chat','admin','training','status'].map(name=>[name,()=>Promise.resolve({default:page(name)})]));
  const App=read('App.jsx',id=>{
    if(id==='react')return React;
    if(id==='socket.io-client')return {io:()=>({on:(name,callback)=>events[name]=callback,disconnect(){}})};
    if(id==='./lib/api')return {apiOrigin:'https://fixture.test'};
    if(id==='./lib/screenData')return {prefetchScreenData(){}};
    if(id==='./context/AuthContext')return {useAuth:()=>auth};
    if(id==='./hooks/useTheme')return {__esModule:true,default:()=>({theme:'dark',toggleTheme:toggle})};
    if(id==='./lib/viewModules')return {viewModules:modules,preloadView(){},scheduleViewWarmup(){warmups++;return ()=>cancellations++;}};
    if(id==='./components/LeaderboardView')return {__esModule:true,default:page('leaderboard')};
    if(id==='./components/Sidebar')return {__esModule:true,default:props=>React.createElement('button',{onClick:()=>props.setActiveTab('pvp')},`PvP ${props.onlineCount}`)};
    if(id==='./components/ViewBoundary')return {__esModule:true,default:props=>props.children};
    return {__esModule:true,default:()=>null};
  }).default;
  let tree;await act(async()=>{tree=create(React.createElement(App));});
  const before=renders.leaderboard;
  for(let i=0;i<50;i++)await act(async()=>events['online:count']({count:i+2}));
  assert.equal(renders.leaderboard,before,'Online counts must not rebuild the current page');
  await act(async()=>tree.root.findByType('button').props.onClick());
  assert.equal(renders.pvp,1);
  for(let i=0;i<20;i++)await act(async()=>events['online:count']({count:i+100}));
  assert.equal(renders.pvp,1,'An opened game screen stays isolated from unrelated shell updates');
  await act(async()=>tree.unmount());assert.equal(warmups,1);assert.equal(cancellations,1);
  console.log('PASS: 70 online-count changes cause zero extra current-page renders, navigation still works, idle warmup cancels on unmount.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
