/**
 * Player Class - Encapsulates player information, piece rosters, and game stats
 */

class Player {
  /**
   * @param {Object} options
   * @param {string} options.id - User or Bot unique ID
   * @param {number} options.playerNumber - 1 or 2
   * @param {string} options.name - Display name
   * @param {number} [options.eloRating] - Current Elo rating
   */
  constructor({ id, playerNumber, name, eloRating = 1200 }) {
    if (playerNumber !== 1 && playerNumber !== 2) {
      throw new Error('[Player] playerNumber must be 1 or 2.');
    }

    this.id = id || `player_${playerNumber}`;
    this.playerNumber = playerNumber;
    this.name = name || `Player ${playerNumber}`;
    this.eloRating = eloRating;

    // In-game dynamic telemetry
    this.remainingPieces = 0;
    this.stats = {
      kills: 0,
      deaths: 0,
      infectionsCaused: 0,
      buffsCollected: 0,
      turnsPlayed: 0,
    };
  }

  /**
   * Update remaining pieces count from current board state
   * @param {number} count
   */
  updatePieceCount(count) {
    this.remainingPieces = count;
  }

  /**
   * Check if player still has active pieces on board
   * @returns {boolean}
   */
  isAlive() {
    return this.remainingPieces > 0;
  }

  /**
   * Record a kill in combat
   */
  recordKill() {
    this.stats.kills++;
  }

  /**
   * Record a piece death in combat
   */
  recordDeath() {
    this.stats.deaths++;
  }

  /**
   * Record an infection conversion
   */
  recordInfection() {
    this.stats.infectionsCaused++;
  }

  /**
   * Record a buff pickup
   */
  recordBuffCollected() {
    this.stats.buffsCollected++;
  }

  /**
   * Export JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      playerNumber: this.playerNumber,
      name: this.name,
      eloRating: this.eloRating,
      remainingPieces: this.remainingPieces,
      isAlive: this.isAlive(),
      stats: { ...this.stats },
    };
  }
}

module.exports = {
  Player,
};
