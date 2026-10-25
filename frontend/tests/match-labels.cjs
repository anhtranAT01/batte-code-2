const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const React=require('react');
const {create,act}=require('react-test-renderer');
const {transformSync}=require('esbuild');
const labelModule={exports:{}};
new Function('module','exports',transformSync(fs.readFileSync(path.resolve(__dirname,'../src/lib/matchLabel.js'),'utf8'),{format:'cjs'}).code)(labelModule,labelModule.exports);
const {matchLabel,matchesMatchNumber}=labelModule.exports;
assert.equal(matchLabel({match_number:'1'}),'#001');
assert.equal(matchLabel({matchNumber:42}),'#042');
assert.equal(matchLabel({match_number:'123456789012345678'}),'#123456789012345678');
assert.equal(matchLabel({id:'old-uuid'}),'Chưa cấp số');
assert.equal(matchesMatchNumber({match_number:'42'},'#042'),true);
assert.equal(matchesMatchNumber({match_number:'42'},'00042'),true);
assert.equal(matchesMatchNumber({match_number:'42'},'#0043'),false);
assert.equal(matchesMatchNumber({match_number:'42'},''),false);

function component(name){
  const module={exports:{}};
  const source=fs.readFileSync(path.resolve(__dirname,`../src/components/${name}.jsx`),'utf8');
  new Function('require','module','exports',transformSync(source,{loader:'jsx',format:'cjs'}).code)(id=>{
    if(id==='../lib/matchLabel') return labelModule.exports;
    if(id==='./GameBoard') return {__esModule:true,default:()=>null};
    return require(id);
  },module,module.exports);
  return module.exports.default;
}
const History=component('DataExplorerView'),Replay=component('ReplayViewer');
const text=n=>Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.children||n.props?.children):String(n??'');
async function main(){
  const source=[{id:'uuid-one',match_number:'8',p1_username:'One'},{id:'uuid-two',match_number:'42',p1_username:'Two'}];
  global.fetch=async()=>({ok:true,json:async()=>({success:true,data:source})});
  let tree,selected;
  await act(async()=>{tree=create(React.createElement(History,{onSelectReplay:id=>{selected=id;}}));});
  assert.match(text(tree.toJSON()),/#008/);assert.match(text(tree.toJSON()),/#042/);
  await act(async()=>{tree.root.findByType('input').props.onChange({target:{value:'#042'}});});
  assert.ok(!text(tree.toJSON()).includes('#008'));assert.match(text(tree.toJSON()),/#042/);
  await act(async()=>{tree.root.findAllByType('button').find(n=>text(n.props.children).includes('Xem replay')).props.onClick();});
  assert.equal(selected,'uuid-two','Display labels never replace UUID action identifiers');
  act(()=>tree.unmount());
  let requested;
  global.fetch=async url=>{requested=url;return {ok:true,json:async()=>({success:true,data:{matchId:'uuid-two',matchNumber:'42',steps:[]}})};};
  await act(async()=>{tree=create(React.createElement(Replay));});
  await act(async()=>{tree.root.findByProps({'aria-label':'Mã trận cần xem lại'}).props.onChange({target:{value:'#042'}});});
  await act(async()=>{await tree.root.findByType('form').props.onSubmit({preventDefault(){}});});
  assert.equal(requested,'/api/game/replay/%23042');
  assert.match(text(tree.toJSON()),/#042/);
  act(()=>tree.unmount());
  console.log('PASS: stable labels survive filtering, search supports #numbers, actions retain UUIDs and replay encodes # correctly');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
