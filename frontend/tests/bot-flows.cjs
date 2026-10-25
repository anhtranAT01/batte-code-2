const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { File } = require('node:buffer');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { transformSync } = require('esbuild');

let auth = { user:{id:'me',username:'Me'}, getAuthHeaders:() => ({Authorization:'Bearer test'}) };
const alerts = [];
global.alert = message => alerts.push(message);
function component(name) {
  const filename = path.resolve(__dirname,`../src/components/${name}.jsx`);
  const js = transformSync(fs.readFileSync(filename,'utf8'),{loader:'jsx',format:'cjs'}).code;
  const module = {exports:{}};
  new Function('require','module','exports',js)((id) => {
    if (id === '../context/AuthContext') return {useAuth:() => auth};
    if (id === './GameBoard') return {__esModule:true,default:() => null};
    return require(id);
  },module,module.exports);
  return module.exports.default;
}
const PvP = component('PvPBotArenaView');
const Boss = component('BossArenaView');
const Vault = component('BotVaultView');
const response = data => ({ok:true,json:async () => ({success:true,data})});
const text = element => Array.isArray(element) ? element.map(text).join('')
  : typeof element === 'object' && element ? text(element.props?.children) : String(element ?? '');
const button = (tree,label) => tree.root.findAllByType('button').find(node => text(node.props.children).includes(label));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise,resolve}; };

async function main() {
  const opponents = [
    {id:'self',user_id:'me',owner_name:'Me'},
    {id:'b1',user_id:'one',owner_name:'One'},
    {id:'b2',user_id:'two',owner_name:'Two'},
    {id:'b3',user_id:'two',owner_name:'Two'},
  ];
  const calls = [];
  global.fetch = async (url,init) => {
    calls.push({url,init});
    return response(url.includes('community') ? opponents : url.includes('my-bots') ? [] : {replay:{steps:[]}});
  };
  let tree;
  await act(async () => { tree = create(React.createElement(PvP)); });
  assert.equal(tree.root.findAllByType('select')[0].props.value,'template_flag_rusher');
  assert.equal(tree.root.findAllByType('select')[1].props.value,'b1');
  await act(async () => { button(tree,'Đổi ngẫu nhiên').props.onClick(); });
  assert.ok(['b2','b3'].includes(tree.root.findAllByType('select')[1].props.value));
  await act(async () => { button(tree,'Đổi ngẫu nhiên').props.onClick(); });
  assert.equal(tree.root.findAllByType('select')[1].props.value,'b1');
  await act(async () => { tree.root.findAllByType('select')[1].props.onChange({target:{value:'b2'}}); });
  auth = {...auth,user:{...auth.user,elo_rating:1300}};
  await act(async () => { tree.update(React.createElement(PvP)); });
  assert.equal(tree.root.findAllByType('select')[1].props.value,'b2');
  await act(async () => { button(tree,'KHỞI TRANH').props.onClick(); });
  const duel = calls.find(call => call.url.includes('bot-vs-bot'));
  assert.deepEqual(JSON.parse(duel.init.body),{
    bot1Id:'template_flag_rusher',bot2Id:'b2',boardSize:9,difficulty:'medium',
  });
  assert.deepEqual(alerts,[]);
  act(() => tree.unmount());
  console.log('PASS: visible default can start PvP; random changes owner; profile refresh preserves opponent');

  global.fetch = async url => response(url.includes('community') ? [opponents[1]] : []);
  await act(async () => { tree = create(React.createElement(PvP)); });
  assert.equal(button(tree,'Đổi ngẫu nhiên').props.disabled,true);
  act(() => tree.unmount());
  console.log('PASS: one available opponent does not offer a misleading random change');

  const pending = deferred();
  let practiceBody;
  global.fetch = async (url,init) => {
    if (url.includes('my-bots')) return pending.promise;
    practiceBody = JSON.parse(init.body);
    return response({replay:{steps:[]}});
  };
  await act(async () => { tree = create(React.createElement(Boss)); });
  await act(async () => { tree.root.findByType('select').props.onChange({target:{value:'template_astar'}}); });
  await act(async () => { pending.resolve(response([{id:'active-upload',is_active:true}])); });
  assert.equal(tree.root.findByType('select').props.value,'template_astar');
  await act(async () => { button(tree,'Khởi Tranh Tự Động').props.onClick(); });
  assert.equal(practiceBody.bot1Id,'template_astar');
  assert.equal(practiceBody.bot2Level,'MEDIUM');
  act(() => tree.unmount());
  console.log('PASS: late bot list cannot overwrite chosen practice bot; start sends selected IDs');

  let uploaded;
  global.fetch = async (url,init) => {
    if (url.includes('/upload')) { uploaded = init.body; return response({id:'uploaded'}); }
    return response([]);
  };
  await act(async () => { tree = create(React.createElement(Vault)); });
  await act(async () => { button(tree,'+ Nộp').props.onClick(); });
  await act(async () => { button(tree,'Tải lên file').props.onClick(); });
  const file = new File(['print("{}")'],'MyBot.PY',{type:'text/x-python'});
  await act(async () => { tree.root.findByProps({type:'file'}).props.onChange({target:{files:[file]}}); });
  // Switching modes unmounts the native input, but the selected File is retained.
  await act(async () => { button(tree,'Dán / soạn').props.onClick(); });
  await act(async () => { button(tree,'Tải lên file').props.onClick(); });
  assert.equal(tree.root.findByProps({type:'file'}).props.required,false);
  await act(async () => { tree.root.findByProps({type:'file'}).props.onChange({target:{files:[]}}); });
  assert.ok(text(tree.root.findByProps({role:'status'}).props.children).includes('MyBot.PY'));
  await act(async () => { await tree.root.findByType('form').props.onSubmit({preventDefault(){}}); });
  assert.equal(uploaded.get('file').name,'MyBot.PY');
  assert.equal(await uploaded.get('file').text(),'print("{}")');
  assert.equal(uploaded.get('name'),'MyBot');
  assert.equal(uploaded.get('tactic'),'FLAG_RUSHER');
  act(() => tree.unmount());
  console.log('PASS: file survives mode changes/cancel and multipart submission contains the selected Python file');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
