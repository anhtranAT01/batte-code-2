// Local mock API for visual/offline QA; never connects to the deployed service.
const express=require('../../backend/node_modules/express');
const fs=require('fs'),path=require('path');
const app=express();app.use(express.json({limit:'3mb'}));
const user={id:'11111111-1111-4111-8111-111111111111',username:'OfflineTester',role:'STUDENT',elo_rating:1200};
let available=true;
const receipts=new Map();
app.post('/fixture/toggle',(req,res)=>{available=!available;res.json({available});});
app.use('/api',(req,res,next)=>available?next():res.status(503).json({message:'Simulated outage'}));
app.get('/api/auth/me',(req,res)=>res.json({data:user}));
app.get('/api/health',(req,res)=>res.json({timestamp:new Date().toISOString(),gateway:'online',database:'online',judge:'online',tournamentJudge:'online'}));
app.get('/api/bots/templates',(req,res)=>res.json({data:[{id:'heuristic_starter',name:'Heuristic Starter',filename:'heuristic.py',code:fs.readFileSync(path.resolve(__dirname,'../../sample-bots/heuristic.py'),'utf8')}]}));
app.get('/api/support/submissions',(req,res)=>res.json({data:[...receipts.values()]}));
app.post('/api/support/submissions',(req,res)=>{const data={id:req.body.id,name:req.body.name,status:'accepted',received_at:new Date().toISOString(),message:'Mock server received'};receipts.set(data.id,data);res.status(202).json({success:true,data});});
app.get('/api/*',(req,res)=>res.json({data:[]}));
const root=path.resolve(__dirname,'../dist');
app.get(['/', '/index.html'],(req,res)=>{
  const fixture=`<script>localStorage.setItem('rps_token','fixture-token');localStorage.setItem('rps_profile',JSON.stringify({token:'fixture-token',user:${JSON.stringify(user)}}));</script><button style="position:fixed;bottom:10px;right:10px;z-index:9999;background:#f97316;color:black;padding:8px" onclick="fetch('/fixture/toggle',{method:'POST'}).then(r=>r.json()).then(d=>this.textContent=d.available?'TEST: API online':'TEST: API offline')">TEST: Toggle API</button>`;
  res.send(fs.readFileSync(path.join(root,'index.html'),'utf8').replace('<head>','<head>'+fixture));
});
app.use(express.static(root));
app.listen(5197,'127.0.0.1',()=>console.log('Isolated preview http://127.0.0.1:5197'));
