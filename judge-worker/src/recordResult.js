function calculateElo(p1Rating, p2Rating, outcome) {
  const K = 32;
  const expectedP1 = 1 / (1 + Math.pow(10, (p2Rating - p1Rating) / 400));
  const expectedP2 = 1 - expectedP1;

  const p1Change = Math.round(K * (outcome - expectedP1));
  const p2Change = Math.round(K * ((1 - outcome) - expectedP2));

  return { p1Change, p2Change };
}


async function recordResult({pool,matchId,player1Id,player2Id,winnerId,winReason,durationMs,hasInfiniteLoopError,replay}) {
  let p1EloChange = 0;
  let p2EloChange = 0;

  const resultClient=await pool.connect();
  try {
    await resultClient.query('BEGIN');
    const prior=(await resultClient.query('SELECT judged_at FROM "Matches" WHERE id=$1 FOR UPDATE',[matchId])).rows[0];
    if(!prior)throw new Error('Match removed');
    if(prior.judged_at){await resultClient.query('ROLLBACK');return {matchId,alreadyRecorded:true};}
    await resultClient.query('SELECT id FROM "Users" WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[[player1Id,player2Id]]);
    const p1Query = await resultClient.query('SELECT elo_rating FROM "Users" WHERE id = $1', [player1Id]);
    const p2Query = await resultClient.query('SELECT elo_rating FROM "Users" WHERE id = $1', [player2Id]);

    const p1Rating = p1Query.rows[0]?.elo_rating || 1200;
    const p2Rating = p2Query.rows[0]?.elo_rating || 1200;

    let outcome = 0.5;
    if (winnerId === player1Id) outcome = 1;
    else if (winnerId === player2Id) outcome = 0;

    const eloResult = calculateElo(p1Rating, p2Rating, outcome);
    p1EloChange = eloResult.p1Change;
    p2EloChange = eloResult.p2Change;

    // Update match record in DB
    await resultClient.query(
      `UPDATE "Matches"
       SET winner_id = $1, win_reason = $2, duration_ms = $3,
           p1_elo_change = $4, p2_elo_change = $5,
           has_infinite_loop_error = $6, replay_json = $7, judged_at=NOW()
       WHERE id = $8`,
      [
        winnerId,
        winReason,
        durationMs,
        p1EloChange,
        p2EloChange,
        hasInfiniteLoopError,
        JSON.stringify(replay),
        matchId,
      ]
    );

    // Update users Elo
    await resultClient.query('UPDATE "Users" SET elo_rating = elo_rating + $1 WHERE id = $2', [p1EloChange, player1Id]);
    await resultClient.query('UPDATE "Users" SET elo_rating = elo_rating + $1 WHERE id = $2', [p2EloChange, player2Id]);

    await resultClient.query('COMMIT');
    console.log(
      `[Judge Worker] Match ${matchId} ended. Winner: ${winnerId || 'DRAW'} (${winReason}). Duration: ${durationMs}ms. InfiniteLoop: ${hasInfiniteLoopError}`
    );
  } catch (dbErr) {
    await resultClient.query('ROLLBACK');
    throw dbErr; // BullMQ retries infrastructure failures; results/Elo commit together.
  } finally {resultClient.release();}

  return {p1EloChange,p2EloChange};
}
module.exports={recordResult};
