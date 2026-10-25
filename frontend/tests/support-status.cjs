const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const React=require('react');
const {create,act}=require('react-test-renderer');
const {transformSync}=require('esbuild');
const entries=[
  {id:'queued',userId:'student',kind:'bot',payload:{name:'Waiting bot'},state:'queued',createdAt:4},
  {id:'reg-a',userId:'student',kind:'tournament',payload:{tournamentId:'cup',teamName:'A'},state:'received',createdAt:3},
  {id:'reg-b',userId:'student',kind:'tournament',payload:{tournamentId:'cup',teamName:'A'},state:'received',createdAt:2},
  {id:'done-bot',userId:'student',kind:'bot',payload:{name:'Accepted bot'},state:'received',createdAt:1},
];
const source=fs.readFileSync(path.resolve(__dirname,'../src/components/DeviceSafety.jsx'),'utf8');
const mod={exports:{}};
new Function('require','module','exports',transformSync(source,{loader:'jsx',format:'cjs'}).code)(id=>{
  if(id==='react')return React;
  if(id==='../context/AuthContext')return {useAuth:()=>({user:{id:'student'},getAuthHeaders:()=>({})})};
  if(id==='../lib/outbox')return {outbox:{list:async()=>entries},subscribeOutbox:()=>()=>{}};
  return require(id);
},mod,mod.exports);
const {default:DeviceSafety,uniqueEntries}=mod.exports;
const text=value=>Array.isArray(value)?value.map(text).join(''):value&&typeof value==='object'?text(value.props?.children):String(value??'');
async function main(){
  global.window={addEventListener(){},removeEventListener(){}};
  let serverRequests=0;
  global.fetch=async()=>{serverRequests++;return {ok:true,json:async()=>({data:[]})};};
  const deduped=uniqueEntries(entries,[]);
  assert.equal(deduped.length,3,'duplicate successful registrations for one tournament collapse to one local receipt');
  let tree;
  await act(async()=>{tree=create(React.createElement(DeviceSafety));});
  const details=tree.root.findAllByType('details')[0];
  assert.equal(details.props.open,undefined,'submission details stay closed until the player opens them');
  const summary=details.props.children[0];
  assert.match(text(summary),/1 cần chú ý · 2 đã hoàn tất/);
  assert.ok(!text(summary).includes('Mã nộp:'));
  assert.equal(serverRequests,0,'collapsed status panel does not load receipt history');
  await act(async()=>details.props.onToggle({currentTarget:{open:true}}));
  assert.equal(serverRequests,1,'opening the panel loads receipts on demand');
  await act(async()=>tree.unmount());
  console.log('PASS: submission details stay collapsed; queued attention remains counted and duplicate completed tournament receipts collapse');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
