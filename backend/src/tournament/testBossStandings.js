const assert=require('node:assert/strict');
const dbPath=require.resolve('../config/db'),redisPath=require.resolve('../config/redis');
const participants=[{userId:'p1',username:'demo',points:4}];
const matches=[
 {player1_id:'p1',player2_id:null,winner_id:'p1',winner_side:1,win_reason:'FLAG_CAPTURE',total_turns:15},
 {player1_id:'p1',player2_id:null,winner_id:null,winner_side:2,win_reason:'FLAG_CAPTURE',total_turns:20},
 {player1_id:'p1',player2_id:null,winner_id:null,winner_side:null,win_reason:'DRAW',total_turns:150},
 {player1_id:'p1',player2_id:null,winner_id:null,win_reason:null,total_turns:0},
];
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{query:async sql=>({rows:sql.includes('FROM "Tournaments"')?[{id:'demo',settings_json:{participants,scoringRules:{winPoints:3,drawPoints:1}}}]:matches}),pool:{}}};
require.cache[redisPath]={id:redisPath,filename:redisPath,loaded:true,exports:{matchQueue:{}}};
require('./tournament.service').getTournamentStandings('demo').then(({standings:[p]})=>{
 assert.equal(p.matchesPlayed,3);assert.equal(p.wins,1);assert.equal(p.losses,1);assert.equal(p.draws,1);assert.equal(p.points,4);
 console.log('PASS Boss wins count as student losses without a Boss account; draws/scoring/pending matches remain correct');
}).catch(e=>{console.error(e);process.exitCode=1;});
