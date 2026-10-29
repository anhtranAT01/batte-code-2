// Real games only. A draw stays unresolved; never fabricate a knockout winner.
async function runRealBrackets({tournament, play, checkpoint}) {
  const brackets = tournament.brackets_json || [];
  const participants = tournament.settings_json?.participants || [];
  let played = 0;
  const nextSlots = {b_qf1:['b_sf1','p1'],b_qf2:['b_sf1','p2'],b_qf3:['b_sf2','p1'],b_qf4:['b_sf2','p2'],b_sf1:['b_fn1','p1'],b_sf2:['b_fn1','p2']};
  const canonical = id => id.replace(/^bracket_/, 'b_');
  const resolve = slot => {
    const p = participants.find(p => p.userId === slot?.userId || p.userId === slot?.id || p.username === slot?.name);
    if(!p?.userId || !p?.botId)throw Object.assign(new Error(`Chưa có người chơi/bot hợp lệ: ${slot?.name || 'ô trống'}.`),{statusCode:400});
    return {...slot,id:p.userId,userId:p.userId,botId:p.botId,name:p.username,bot:p.botName};
  };
  // Validate every starting slot before any match is run.
  for(const match of brackets.filter(m=>m.round===1&&m.status!=='COMPLETED')) {resolve(match.p1);resolve(match.p2);}
  for(const match of [...brackets].sort((a,b)=>a.round-b.round || a.matchNumber-b.matchNumber)) {
    if(match.status==='COMPLETED')continue;
    if(!match.p1?.name || !match.p2?.name || /^Thắng /.test(match.p1.name) || /^Thắng /.test(match.p2.name))continue;
    const p1=resolve(match.p1),p2=resolve(match.p2);
    if(p1.userId===p2.userId)throw Object.assign(new Error('Một người chơi không thể tự đấu trong nhánh.'),{statusCode:400});
    const result = await play({userId:p1.userId,userName:p1.name,bot1Id:p1.botId,bot2Id:p2.botId,tournamentId:tournament.id,boardSize:tournament.settings_json?.boardSize||9,difficulty:'medium'});
    if(!result.matchId)throw new Error('Máy chấm chưa lưu mã trận.');
    match.matchId=result.matchId;match.matchNumber=result.matchNumber;match.winReason=result.winReason;
    match.p1={...p1,score:result.winner===1?1:0};match.p2={...p2,score:result.winner===2?1:0};
    played++;
    if(result.winner!==1&&result.winner!==2) {
      match.status='DRAW';match.winner=null;
      await checkpoint(brackets,'ONGOING');
      continue;
    }
    const winner=result.winner===1?p1:p2;
    match.winner=winner.name;match.status='COMPLETED';
    const next=nextSlots[canonical(match.id)];
    if(next) {const target=brackets.find(m=>canonical(m.id)===next[0]);if(target)target[next[1]]={...winner,score:null};}
    await checkpoint(brackets,brackets.every(m=>m.status==='COMPLETED')?'COMPLETED':'ONGOING');
  }
  return {brackets,played,completed:brackets.length>0&&brackets.every(m=>m.status==='COMPLETED')};
}
module.exports={runRealBrackets};
