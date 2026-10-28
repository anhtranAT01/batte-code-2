const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const React=require('react'),{act,create}=require('react-test-renderer'),{buildSync}=require('esbuild');
function load(file){const m={exports:{}};new Function('require','module','exports',buildSync({entryPoints:[path.resolve(__dirname,'../src/components',file)],bundle:true,write:false,platform:'node',format:'cjs',external:['react'],loader:{'.css':'empty'}}).outputFiles[0].text)(require,m,m.exports);return m.exports;}
const Training=load('AlgorithmTrainingView.jsx').default,Rules=load('RulesAndStrategyView.jsx').default;
const {ALGORITHMS}=load('trainingLessons.js');
const text=n=>Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.children || n.props?.children):String(n??'');
const hasClass=(n,name)=>String(n.props.className || '').split(' ').includes(name);
async function main(){
  const astar=ALGORITHMS[0],route=astar.steps.at(-1).gridState.path;
  for(const step of astar.steps){
    const [r,c]=step.gridState.path.at(-1);
    assert.equal(step.stats.gn,step.gridState.path.length-1);assert.equal(step.stats.hn,Math.max(6-r,6-c));assert.equal(step.stats.fn,step.stats.gn+step.stats.hn);
  }
  const blocked=new Set(astar.steps[0].gridState.obstacles.map(p=>p.join(',')));
  for(let i=1;i<route.length;i++){assert.equal(Math.max(Math.abs(route[i][0]-route[i-1][0]),Math.abs(route[i][1]-route[i-1][1])),1);assert.ok(!blocked.has(route[i].join(',')));}
  const queue=[[0,0,0]],seen=new Set(['0,0']);let shortest;
  for(let i=0;i<queue.length;i++){const [r,c,d]=queue[i];if(r===6&&c===6){shortest=d;break;}
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){const nr=r+dr,nc=c+dc,k=`${nr},${nc}`;if(nr<0||nr>6||nc<0||nc>6||blocked.has(k)||seen.has(k))continue;seen.add(k);queue.push([nr,nc,d+1]);}}
  assert.equal(route.length-1,shortest,'The taught A* route is legal and shortest for the example map');
  let tree,navigations=0;
  act(()=>{tree=create(React.createElement(Training,{onGoToBots:()=>navigations++}));});
  const cells=()=>tree.root.findAllByProps({role:'gridcell'});
  assert.equal(cells().length,49);assert.equal(cells().filter(n=>n.props.tabIndex===0).length,1);
  act(()=>tree.root.findByProps({'data-cell':'2-1'}).props.onClick());
  assert.ok(text(tree.root.findByProps({role:'status'})).includes('Vật cản'));
  let focused;
  act(()=>tree.root.findByProps({'data-cell':'2-1'}).props.onKeyDown({key:'ArrowRight',preventDefault(){},currentTarget:{closest:()=>({querySelector:selector=>({focus:()=>{focused=selector;}})})}}));
  assert.equal(focused,'[data-cell="2-2"]');
  act(()=>tree.root.findByProps({'aria-label':'Bước kế tiếp'}).props.onClick());
  assert.equal(cells().find(n=>n.props['data-cell']==='1-1').props.className.includes('is-current'),true);
  assert.ok(text(tree.root.findByProps({'aria-label':'Giải thích bước hiện tại'})).includes('g = 1'));
  act(()=>tree.root.findAllByType('button').find(n=>n.props['aria-label']?.startsWith('Bước 6:')).props.onClick());
  assert.equal(tree.root.findByProps({'aria-label':'Bước kế tiếp'}).props.disabled,true);
  const setTimeoutOriginal=global.setTimeout,clearTimeoutOriginal=global.clearTimeout,timers=new Map();let timerId=0;
  try{
    global.setTimeout=(callback,delay)=>{const id=++timerId;timers.set(id,{callback,delay});return id;};global.clearTimeout=id=>timers.delete(id);
    act(()=>tree.root.findAllByType('button').find(n=>text(n)==='Xem lại').props.onClick());
    assert.equal(timers.size,1);
    const [id,timer]=timers.entries().next().value;timers.delete(id);act(()=>timer.callback());
    assert.ok(text(tree.root.findByProps({'aria-label':'Giải thích bước hiện tại'})).includes('BƯỚC 2'));
    act(()=>tree.root.findAllByType('button').find(n=>text(n).includes('Minimax & Alpha-Beta')).props.onClick());
    assert.equal(timers.size,0,'Changing lessons cancels playback');
    assert.ok(text(tree.root.findByProps({'aria-label':'Giải thích bước hiện tại'})).includes('BƯỚC 1'));
    act(()=>tree.root.findAllByType('button').find(n=>text(n).includes('Đánh giá Heuristic')).props.onClick());
    assert.equal(tree.root.findAll(n=>hasClass(n,'lesson-piece')).length,5);
    act(()=>tree.root.findAllByType('button').find(n=>text(n)==='Mở Kho bot ↗').props.onClick());assert.equal(navigations,1);
    act(()=>tree.unmount());assert.equal(timers.size,0);
  }finally{global.setTimeout=setTimeoutOriginal;global.clearTimeout=clearTimeoutOriginal;}
  act(()=>{tree=create(React.createElement(Rules,{onGoToTemplates:()=>navigations++}));});
  assert.equal(tree.root.findAllByType('section').length,4);
  for(const title of ['Kéo thắng Giấy','Búa thắng Kéo','Giấy thắng Búa'])assert.ok(text(tree.toJSON()).includes(title));
  assert.ok(text(tree.toJSON()).includes('(7, 7)'));
  act(()=>tree.root.findAllByType('button').find(n=>text(n).trim()==='Mở bot mẫu').props.onClick());assert.equal(navigations,2);act(()=>tree.unmount());
  console.log('PASS: 49-cell accessible lesson board, cell inspection/arrows, step/metrics sync, restart autoplay, switch/unmount timer cleanup, all three lessons and rules navigation.');
  console.log('PASS: A* teaching path avoids obstacles, uses consistent g/h/f and is shortest under the stated 8-direction model.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
