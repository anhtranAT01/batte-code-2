const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const React=require('react'),{create,act}=require('react-test-renderer'),{transformSync}=require('esbuild');
function load(name){
  const m={exports:{}};
  new Function('require','module','exports',transformSync(fs.readFileSync(path.join(__dirname,`../src/components/${name}.jsx`),'utf8'),{loader:'jsx',format:'cjs'}).code)(id=>{
    if(id==='../lib/matchLabel')return {matchLabel:m=>`#${m.match_number || m.matchNumber || 1}`};
    if(id==='./GameBoard')return {__esModule:true,default:()=>null};
    if(id==='../context/AuthContext')return {useAuth:()=>({})};
    if(id==='../lib/publicData')return {invalidatePublicData(){}};
    return require(id);
  },m,m.exports);return m.exports;
}
const Replay=load('ReplayViewer').default,Settings=load('AdminDashboardView').ReplayRetentionSettings;
const text=n=>Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.children || n.props?.children):String(n??'');
const button=(tree,label)=>tree.root.findAllByType('button').find(n=>text(n.props.children).includes(label));
const fixture={matchId:'fixture',replayExpiresAt:'2026-10-30T10:00:00Z',steps:Array.from({length:320},(_,i)=>({step:i+1,player:1,boardSnapshot:[[i]]}))};
async function main(){
  let tree;
  await act(async()=>{tree=create(React.createElement(Replay,{initialReplay:fixture}));});
  assert.match(text(tree.toJSON()),/Replay được lưu đến/,'Display the deadline returned by the server policy');
  const visibleSteps=()=>tree.root.findAllByType('span').filter(n=>text(n.props.children).startsWith('Bước #')).map(n=>text(n.props.children));
  assert.equal(visibleSteps().length,50);
  assert.ok(visibleSteps()[0].startsWith('Bước #1 '));
  await act(async()=>button(tree,'Nhật ký sau').props.onClick());
  assert.ok(visibleSteps()[0].startsWith('Bước #51 '));
  await act(async()=>button(tree,'Cuối').props.onClick());
  assert.equal(visibleSteps().length,20);
  assert.ok(visibleSteps().at(-1).startsWith('Bước #320 '));
  assert.equal(tree.root.findByProps({type:'range'}).props.value,319);
  await act(async()=>button(tree,'Đầu').props.onClick());
  await act(async()=>button(tree,'Nhật ký sau').props.onClick());
  await act(async()=>tree.update(React.createElement(Replay,{initialReplay:{...fixture,steps:fixture.steps.slice(0,10)}})));
  assert.equal(visibleSteps().length,10,'New replay resets manual log pagination even if the board was already at step zero');
  await act(async()=>tree.unmount());

  const requests=[];
  global.fetch=(url,init)=>new Promise(resolve=>requests.push({url,init,resolve}));
  await act(async()=>{tree=create(React.createElement(Replay,{initialReplay:'old-id'}));});
  await act(async()=>tree.update(React.createElement(Replay,{initialReplay:'new-id'})));
  assert.equal(requests[0].init.signal.aborted,true);
  await act(async()=>requests[1].resolve({ok:true,json:async()=>({success:true,data:{...fixture,matchId:'new-id',p1Name:'NEW RESULT'}})}));
  await act(async()=>requests[0].resolve({ok:true,json:async()=>({success:true,data:{...fixture,matchId:'old-id',p1Name:'OLD RESULT'}})}));
  assert.ok(text(tree.toJSON()).includes('NEW RESULT'));
  assert.ok(!text(tree.toJSON()).includes('OLD RESULT'));
  await act(async()=>tree.update(React.createElement(Replay,{initialReplay:'expired-id'})));
  await act(async()=>requests[2].resolve({ok:false,json:async()=>({success:false,message:'Replay đã hết hạn.'})}));
  assert.ok(text(tree.toJSON()).includes('Replay đã hết hạn.'));
  assert.equal(visibleSteps().length,0,'An expired lookup must not leave the previous replay visible');
  await act(async()=>tree.unmount());

  let configured=0,confirmResult=false;const saves=[];
  global.window={confirm:()=>confirmResult};
  global.fetch=async(url,init={})=>{
    if(init.method==='PUT'){saves.push(JSON.parse(init.body));configured=JSON.parse(init.body).days;}
    return {ok:true,json:async()=>({data:{days:configured,checkIntervalMinutes:5}})};
  };
  await act(async()=>{tree=create(React.createElement(Settings,{getAuthHeaders:()=>({Authorization:'test'})}));});
  const input=()=>tree.root.findByProps({id:'replay-retention-days'});
  assert.equal(input().props.value,'0');
  assert.match(text(tree.toJSON()),/Thời gian lưu replay PvP/);
  assert.match(text(tree.toJSON()),/Trận đấu với máy luôn tự hết hạn sau 24 giờ/);
  await act(async()=>input().props.onChange({target:{value:'1.5'}}));
  await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
  assert.equal(saves.length,0);
  await act(async()=>input().props.onChange({target:{value:'7'}}));
  await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
  assert.equal(saves.length,0,'Cancel must not enable destructive cleanup');
  confirmResult=true;
  await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
  assert.deepEqual(saves,[{days:7}]);
  await act(async()=>input().props.onChange({target:{value:'0'}}));
  confirmResult=false;
  await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
  assert.deepEqual(saves,[{days:7},{days:0}],'Disabling cleanup needs no deletion confirmation');
  await act(async()=>tree.unmount());
  console.log('PASS: 320-step replay mounts at most 50 logs, pagination/seek, stale load cancellation, expired lookup clears old data; retention defaults, validation, confirmation/cancel and disable.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
