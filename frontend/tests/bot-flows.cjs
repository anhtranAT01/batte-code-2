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
const helperModules = new Map();
function helper(filename) {
  if (helperModules.has(filename)) return helperModules.get(filename);
  const js = transformSync(fs.readFileSync(filename,'utf8'),{loader:'js',format:'cjs'}).code;
  const module = {exports:{}};
  new Function('require','module','exports',js)(require,module,module.exports);
  helperModules.set(filename,module.exports);
  return module.exports;
}
function component(name) {
  const filename = path.resolve(__dirname,`../src/components/${name}.jsx`);
  const js = transformSync(fs.readFileSync(filename,'utf8'),{loader:'jsx',format:'cjs'}).code;
  const module = {exports:{}};
  new Function('require','module','exports',js)((id) => {
    if (id === '../context/AuthContext') return {useAuth:() => auth};
    if (id === './GameBoard') return {__esModule:true,default:() => null};
    if (id.startsWith('../lib/')) return helper(path.resolve(path.dirname(filename),`${id}.js`));
    return require(id);
  },module,module.exports);
  return module.exports.default;
}
const PvP = component('PvPBotArenaView');
const Boss = component('BossArenaView');
const Vault = component('BotVaultView');
const AuthModal = component('AuthModal');
const History = component('DataExplorerView');
const response = data => ({ok:true,json:async () => ({success:true,data})});
const text = element => Array.isArray(element) ? element.map(text).join('')
  : typeof element === 'object' && element ? text(element.props?.children) : String(element ?? '');
const button = (tree,label) => tree.root.findAllByType('button').find(node => text(node.props.children).includes(label));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return {promise,resolve}; };

async function main() {
  const players = [
    {id:'me',username:'Me',ready:true,bot:{id:'mine',name:'My uploaded algorithm'}},
    {id:'one',username:'One',ready:true,bot:{id:'official-one',name:'Official One'}},
    {id:'two',username:'Two',ready:true,bot:{id:'official-two',name:'Official Two'}},
    {id:'three',username:'Three',ready:false,bot:null,reason:'Người chơi chưa chọn bot chính.'},
    {id:'lost',username:'Lost',ready:false,bot:{id:'missing',name:'Missing file'},reason:'Bot chính cần tải lại file.'},
  ];
  const calls = [];
  global.fetch = async (url,init) => {
    calls.push({url,init});
    return response(url.includes('/players') ? [...players] : {replay:{steps:[]}});
  };
  let tree;
  await act(async () => { tree = create(React.createElement(PvP)); });
  assert.equal(tree.root.findAllByType('select').length,1,'Only the player can be selected, never their bot');
  assert.equal(tree.root.findByType('select').props.value,'one');
  assert.equal(tree.root.findByType('select').findAllByType('option').length,5,'Unready and missing-file players stay visible');
  await act(async () => { button(tree,'Đổi ngẫu nhiên').props.onClick(); });
  assert.notEqual(tree.root.findByType('select').props.value,'one');
  await act(async () => { tree.root.findByType('select').props.onChange({target:{value:'three'}}); });
  assert.equal(tree.root.findByType('select').props.value,'three');
  assert.equal(button(tree,'KHỞI TRANH').props.disabled,true);
  await act(async () => { tree.root.findByType('select').props.onChange({target:{value:'two'}}); });
  auth = {...auth,user:{...auth.user,elo_rating:1300}};
  await act(async () => { tree.update(React.createElement(PvP)); });
  assert.equal(tree.root.findByType('select').props.value,'two');
  players[2] = {...players[2],bot:{id:'new-official',name:'New Official Two'}};
  await act(async () => { button(tree,'Làm mới').props.onClick(); });
  assert.ok(tree.root.findAllByType('strong').some(node => text(node.props.children) === 'New Official Two'));
  await act(async () => { button(tree,'KHỞI TRANH').props.onClick(); });
  const duel = calls.find(call => call.url === '/api/game/pvp');
  assert.deepEqual(JSON.parse(duel.init.body),{opponentUserId:'two',boardSize:9});
  assert.deepEqual(alerts,[]);
  act(() => tree.unmount());
  console.log('PASS: all players are selectable, unready players explain readiness, official bots are read-only, PvP sends only the player ID');

  global.fetch = async () => response(players.slice(0,2));
  await act(async () => { tree = create(React.createElement(PvP,{preselectedOpponent:{id:'one',username:'One'}})); });
  assert.equal(tree.root.findByType('select').props.value,'one');
  assert.equal(button(tree,'Đổi ngẫu nhiên').props.disabled,true);
  act(() => tree.unmount());
  console.log('PASS: leaderboard challenges resolve by player ID; a single opponent cannot be randomly changed');
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
  assert.equal(tree.root.findAllByType('select').length,0,'Vault has no tactic override');
  await act(async () => { button(tree,'+ Nộp').props.onClick(); });
  assert.equal(tree.root.findAllByType('select').length,0,'Upload form has no tactic override');
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
  assert.equal(uploaded.get('tactic'),null);
  act(() => tree.unmount());
  console.log('PASS: file survives mode changes/cancel and multipart submission contains the selected Python file');

  let registration;
  auth = {...auth,register:async (...args) => { registration = args; }};
  await act(async () => { tree = create(React.createElement(AuthModal,{isOpen:true,initialMode:'register',onClose(){}})); });
  assert.equal(tree.root.findAllByProps({id:'admin-registration-secret'}).length,0);
  await act(async () => { tree.root.findByType('select').props.onChange({target:{value:'ADMIN'}}); });
  assert.equal(tree.root.findByProps({id:'admin-registration-secret'}).props.required,true);
  await act(async () => { tree.root.findByProps({id:'admin-registration-secret'}).props.onChange({target:{value:'test-secret'}}); });
  await act(async () => { await tree.root.findByType('form').props.onSubmit({preventDefault(){}}); });
  assert.equal(registration[2],'ADMIN');
  assert.equal(registration[3],'test-secret');
  await act(async () => { tree.root.findByType('select').props.onChange({target:{value:'STUDENT'}}); });
  await act(async () => { await tree.root.findByType('form').props.onSubmit({preventDefault(){}}); });
  assert.equal(registration[3],undefined);
  act(() => tree.unmount());
  console.log('PASS: admin signup alone requests separate secret; ordinary signup never sends it');

  global.fetch = async () => response([
    {id:'boss-win',p1_username:'trex',p2_username:'Boss AI',winner_username:'Boss AI',winner_side:2,result_known:true,win_reason:'FLAG_CAPTURE'},
    {id:'draw',p1_username:'trex',p2_username:'Boss AI',winner_side:null,result_known:true,win_reason:'DRAW'},
  ]);
  await act(async () => { tree = create(React.createElement(History)); });
  const labels = tree.root.findAllByType('span').map(node => text(node.props.children));
  assert.ok(labels.includes('Boss AI THẮNG'));
  assert.equal(labels.filter(label => label === 'HÒA').length,1);
  assert.ok(tree.root.findAllByType('th').some(node => text(node.props.children) === 'XANH (P1)'));
  act(() => tree.unmount());
  console.log('PASS: Boss wins are not displayed as draws; history identifies Blue P1 and Red P2');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
