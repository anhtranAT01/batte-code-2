/**
 * Swiss Pairing Algorithm - Supports up to 1000 participants
 * Generates fair, balanced pairings based on tournament score brackets,
 * previous match histories, and Elo ratings.
 */

/**
 * Generate Swiss pairings for a round
 * @param {Array<Object>} participants - Array of participant objects
 * @param {Array<Object>} previousMatches - Array of previous matches in tournament
 * @returns {{ pairings: Array<{ player1: Object, player2: Object }>, bye: Object|null }}
 */
function generateSwissPairings(participants = [], previousMatches = []) {
  if (participants.length < 2) {
    return { pairings: [], bye: null };
  }

  // Build match history graph: Set of "p1_id:p2_id" to prevent rematches
  const playedPairs = new Set();
  const byeRecipients = new Set();

  for (const m of previousMatches) {
    if (m.player1_id && m.player2_id) {
      playedPairs.add(`${m.player1_id}:${m.player2_id}`);
      playedPairs.add(`${m.player2_id}:${m.player1_id}`);
    } else if (m.is_bye && m.player1_id) {
      byeRecipients.add(m.player1_id);
    }
  }

  // Sort participants by score descending, then Elo descending
  const sorted = [...participants].sort((a, b) => {
    if ((b.points || 0) !== (a.points || 0)) {
      return (b.points || 0) - (a.points || 0);
    }
    return (b.elo || 1200) - (a.elo || 1200);
  });

  const unpaired = [...sorted];
  let bye = null;

  // If odd number of participants, assign a bye (1 point) to lowest eligible player
  if (unpaired.length % 2 === 1) {
    for (let i = unpaired.length - 1; i >= 0; i--) {
      if (!byeRecipients.has(unpaired[i].id)) {
        bye = unpaired.splice(i, 1)[0];
        break;
      }
    }
    // Fallback if all have had a bye
    if (!bye) {
      bye = unpaired.pop();
    }
  }

  const pairings = [];
  const matched = new Set();

  for (let i = 0; i < unpaired.length; i++) {
    if (matched.has(unpaired[i].id)) continue;

    const p1 = unpaired[i];
    let matchedOpponent = null;
    let fallbackOpponent = null;

    // Search for opponent in same or adjacent score bracket who has not played p1
    for (let j = i + 1; j < unpaired.length; j++) {
      const p2 = unpaired[j];
      if (matched.has(p2.id)) continue;

      const hasPlayed = playedPairs.has(`${p1.id}:${p2.id}`);
      if (!hasPlayed) {
        matchedOpponent = p2;
        break;
      } else if (!fallbackOpponent) {
        fallbackOpponent = p2; // Rematch allowed only if impossible otherwise
      }
    }

    const chosen = matchedOpponent || fallbackOpponent;

    if (chosen) {
      pairings.push({ player1: p1, player2: chosen });
      matched.add(p1.id);
      matched.add(chosen.id);
    }
  }

  return {
    pairings,
    bye,
  };
}

module.exports = {
  generateSwissPairings,
};
