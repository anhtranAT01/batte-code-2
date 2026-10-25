function normalizeMatch(row) {
  let replay = row.replay_json;
  if (typeof replay === 'string') { try { replay = JSON.parse(replay); } catch { replay = null; } }
  const metadata = replay && !Array.isArray(replay) ? replay : {};
  // Old practice games stored the human account in both player columns.
  const legacyPractice = row.player1_id && row.player1_id === row.player2_id && !row.player2_bot_id;
  const practice = metadata.mode === 'PRACTICE' || (metadata.mode !== 'PVP' && (legacyPractice || !row.player2_id));
  const p1 = metadata.p1Name || row.p1_username || 'Khách';
  const p2 = metadata.p2Name || (practice ? 'Boss AI' : row.p2_username || 'Người chơi đã xóa');
  let winner = null;
  let known = false;
  if (Object.hasOwn(metadata,'winner') && [1,2,null].includes(metadata.winner)) {
    winner = metadata.winner;
    known = true;
  } else if (row.winner_id) {
    winner = row.winner_id === row.player1_id ? 1 : row.winner_id === row.player2_id ? 2 : null;
    known = winner !== null;
  } else if (row.win_reason === 'DRAW') {
    known = true;
  } else if (row.win_reason === 'MAX_TURNS_REACHED') {
    known = false;
  } else if (practice && row.win_reason) {
    winner = 2;
    known = true;
  }
  return {...row,mode:practice ? 'PRACTICE' : 'PVP',
    p1_username:p1,p2_username:p2,
    p1_bot_name:metadata.p1BotName || row.p1_bot_name,
    p2_bot_name:metadata.p2BotName || row.p2_bot_name || (practice ? 'Bot hệ thống' : null),
    winner_side:winner,result_known:known,winner_username:known && winner ? (winner === 1 ? p1 : p2) : null};
}
module.exports = {normalizeMatch};
