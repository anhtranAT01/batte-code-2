// Local mock API for visual/offline QA; never connects to the deployed service.
const express=require('../../backend/node_modules/express');
const fs=require('fs'),path=require('path');
const app=express();app.use(express.json({limit:'3mb'}));
const apiHits={};
app.get('/fixture/metrics',(req,res)=>res.json(apiHits));
app.use('/api',(req,res,next)=>{apiHits[req.path]=(apiHits[req.path] || 0)+1;const delay=Number(process.env.PREVIEW_API_DELAY_MS)||0;if(delay)setTimeout(next,delay);else next();});
const user={id:'11111111-1111-4111-8111-111111111111',username:'OfflineTester',role:process.env.PREVIEW_ROLE==='ADMIN'?'ADMIN':'STUDENT',elo_rating:1200};
let replayRetentionDays=0;
let available=true;
const receipts=new Map();
const peers=[user,{id:'22222222-2222-4222-8222-222222222222',username:'CyberWarriors',elo_rating:1520},{id:'33333333-3333-4333-8333-333333333333',username:'AlphaTeam',elo_rating:1380}];
const tourneys=[{id:'t-1',name:'Giải đấu thuật toán sinh viên 2026',mode:'ALL_IN',status:'UPCOMING',scheduledStartAt:new Date(Date.now()+172800000).toISOString(),max_participants:1000},{id:'t-2',name:'Cúp chiến thuật — Vòng loại mùa thu',mode:'BRANCHES',status:'UPCOMING',max_participants:16}];
app.post('/fixture/toggle',(req,res)=>{available=!available;res.json({available});});
app.use('/api',(req,res,next)=>available?next():res.status(503).json({message:'Simulated outage'}));
app.get('/api/auth/me',(req,res)=>res.json({data:user}));
app.get('/api/admin/users',(req,res)=>res.json({success:true,data:peers.map(p=>({...p,role:p.role || 'STUDENT',created_at:new Date().toISOString()}))}));
app.get('/api/admin/replay-retention',(req,res)=>res.json({success:true,data:{days:replayRetentionDays,checkIntervalMinutes:5}}));
app.put('/api/admin/replay-retention',(req,res)=>{replayRetentionDays=req.body.days;res.json({success:true,data:{days:replayRetentionDays,checkIntervalMinutes:5}});});
app.get('/api/health',(req,res)=>res.json({timestamp:new Date().toISOString(),gateway:'online',database:'online',judge:'online',tournamentJudge:'online'}));
app.get('/api/game/leaderboard',(req,res)=>res.json({success:true,data:peers.map((p,i)=>({...p,wins:12-i*3,losses:i+2,draws:1,active_bots:1}))}));
app.get('/api/tournaments',(req,res)=>res.json({success:true,data:tourneys}));
app.get('/api/tournaments/:id/standings',(req,res)=>res.json({success:true,data:{tournament:tourneys.find(t=>t.id===req.params.id),standings:peers.map((p,i)=>({...p,userId:p.id,teamName:p.username,points:9-i*3,wins:3-i,losses:i,elo:p.elo_rating,botName:'Heuristic'}))}}));
app.get('/api/bots/my-bots',(req,res)=>res.json({success:true,data:[{id:'b-1',name:'Heuristic — Chiến thuật cướp cờ',is_active:true,status:'active',is_available:true}]}));
app.get('/api/bots/players',(req,res)=>res.json({success:true,data:peers.map(p=>({...p,ready:true,bot:{id:'b-'+p.id,name:'Heuristic'}}))}));
app.get('/api/bots/templates',(req,res)=>res.json({data:[{id:'heuristic_starter',name:'Heuristic Starter',filename:'heuristic.py',code:fs.readFileSync(path.resolve(__dirname,'../../sample-bots/heuristic.py'),'utf8')}]}));
app.get('/api/support/submissions',(req,res)=>res.json({data:[...receipts.values()]}));
const executor=require('../../backend/src/game/duelExecutor');
app.post('/api/game/bot-vs-bot',async(req,res)=>{
  const controller=new AbortController();res.on('close',()=>controller.abort());
  const meta={matchId:'local-preview',p1Name:'Bot mẫu của bạn',p2Name:'Boss AI'};
  res.setHeader('Content-Type','application/x-ndjson');res.flushHeaders();
  const send=event=>{if(!res.destroyed)res.write(JSON.stringify(event)+'\n');};
  try{
    const data=await executor.run({matchId:meta.matchId,size:req.body.boardSize||9,difficulty:'easy',participants:{1:{name:meta.p1Name,level:'HARD'},2:{name:meta.p2Name,level:req.body.bot2Level||'EASY'}}},
      {signal:controller.signal,onProgress:event=>send(event.type==='started'?{...event,data:{...event.data,...meta}}:event)});
    send({type:'completed',data:{...data,...meta}});
  }catch(error){send({type:'error',message:error.message});}finally{res.end();}
});
app.post('/api/support/submissions',(req,res)=>{const data={id:req.body.id,name:req.body.name,status:'accepted',received_at:new Date().toISOString(),message:'Mock server received'};receipts.set(data.id,data);res.status(202).json({success:true,data});});
app.get('/api/*',(req,res)=>res.json({data:[]}));
const root=path.resolve(__dirname,'../dist');
app.get('/fixture/responsive',(req,res)=>{
  const width=[390,768,1024].includes(Number(req.query.width))?Number(req.query.width):390;
  const view=['training','rules','boss','pvp','tournament','leaderboard'].includes(req.query.view)?req.query.view:'training';
  res.send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Responsive QA · ${width}px</title><style>html,body{margin:0;height:100%;background:#dfe5ed}body{display:grid;place-items:center}iframe{display:block;width:${width}px;max-width:100%;height:calc(100vh - 24px);border:0;border-radius:12px;box-shadow:0 5px 40px #64748b44}</style></head><body><iframe title="Giao diện ${width}px" src="/?fixture_view=${view}"></iframe><script>
    const frame=document.querySelector('iframe');frame.addEventListener('load',()=>{const doc=frame.contentDocument;
      const capture=()=>{const main=doc.querySelector('main'),view=doc.querySelector('.learning-view');document.documentElement.dataset.responsiveQa=JSON.stringify({viewport:frame.clientWidth,mainWidth:main?.clientWidth,mainScrollWidth:main?.scrollWidth,viewWidth:view?.clientWidth,viewScrollWidth:view?.scrollWidth,cells:doc.querySelectorAll('.lesson-cell').length});};
      new MutationObserver(capture).observe(doc.documentElement,{subtree:true,childList:true,attributes:true});capture();});
  </script></body></html>`);
});
app.get(['/', '/index.html'],(req,res)=>{
  const fixture=`<script>${process.env.PREVIEW_THEME==='light'?"localStorage.setItem('battlecode-theme','light');":''}localStorage.setItem('rps_token','fixture-token');localStorage.setItem('rps_profile',JSON.stringify({token:'fixture-token',user:${JSON.stringify(user)}}));</script><button style="position:fixed;bottom:10px;right:10px;z-index:9999;background:#f97316;color:black;padding:8px" onclick="fetch('/fixture/toggle',{method:'POST'}).then(r=>r.json()).then(d=>this.textContent=d.available?'TEST: API online':'TEST: API offline')">TEST: Toggle API</button>`;
  const metrics=process.env.PREVIEW_NAV_METRICS==='1'?`<script>
    let observer,sequence=0;
    document.addEventListener('click',event=>{
      const button=event.target.closest('button[data-nav]');if(!button)return;
      const tab=button.dataset.nav,expected={pvp:'Đấu bot PvP',boss:'Thử thách chiến thuật',tournament:'Giải đấu BattleCode',bots:'Kho Bot'}[tab];
      if(!expected)return;observer?.disconnect();const start=performance.now(),id=++sequence;let screenMs=null,scheduled=false;
      document.documentElement.dataset.fixtureNavigation=JSON.stringify({id,tab,screenMs:null,readyMs:null});
      const check=()=>{scheduled=false;const main=document.querySelector('main');if(!main?.textContent.toLowerCase().includes(expected.toLowerCase()))return;
        screenMs??=Math.round(performance.now()-start);
        const play=[...main.querySelectorAll('button')].find(node=>node.textContent.includes('KHỞI TRANH ĐẤU BOT'));
        const ready=tab!=='pvp'||(play&&!play.disabled);
        document.documentElement.dataset.fixtureNavigation=JSON.stringify({id,tab,screenMs,readyMs:ready?Math.round(performance.now()-start):null});
        if(ready)observer.disconnect();};
      const schedule=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(check);}};
      observer=new MutationObserver(schedule);observer.observe(document.getElementById('root'),{subtree:true,childList:true,attributes:true,characterData:true});schedule();
    },true);
  </script>`:'';
  const view=['training','rules','boss','pvp','tournament','leaderboard'].includes(req.query.fixture_view)?req.query.fixture_view:null;
  const initialView=view?`<script>document.addEventListener('DOMContentLoaded',()=>{const open=()=>{const button=document.querySelector('[data-nav="${view}"]');if(button){observer.disconnect();button.click();}};const observer=new MutationObserver(open);observer.observe(document.getElementById('root'),{childList:true,subtree:true});open();});</script>`:'';
  const fixtureHtml=process.env.PREVIEW_CONTROLS==='0'?fixture.replace(/<button[\s\S]*<\/button>/,''):fixture;
  res.send(fs.readFileSync(path.join(root,'index.html'),'utf8').replace('<head>','<head>'+fixtureHtml+metrics+initialView));
});
app.use(express.static(root));
const port=Number(process.env.PREVIEW_PORT)||5197;
const server=app.listen(port,'127.0.0.1',()=>console.log(`Isolated preview http://127.0.0.1:${port}`));
const {Server}=require('../../backend/node_modules/socket.io');
const io=new Server(server);io.on('connection',socket=>socket.emit('online:count',{count:8}));
server.on('close',()=>executor.shutdown());
