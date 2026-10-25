/**
 * Game Module Index - Tactical Rock-Paper-Scissors Engine Package
 */

const constants = require('./constants');
const { GamePiece } = require('./piece');
const { generateMap, createBoardMatrix, getSymmetricalPair } = require('./mapGenerator');
const { GameEngine } = require('./gameEngine');
const {
  PracticeBot,
  EasyPracticeBot,
  MediumPracticeBot,
  HardPracticeBot,
  FlagRusherPracticeBot,
  getPracticeBot,
} = require('./practiceBots');
const gameService = require('./gameService');
const gameRoutes = require('./gameRoutes');

module.exports = {
  ...constants,
  GamePiece,
  generateMap,
  createBoardMatrix,
  getSymmetricalPair,
  GameEngine,
  PracticeBot,
  EasyPracticeBot,
  MediumPracticeBot,
  HardPracticeBot,
  FlagRusherPracticeBot,
  getPracticeBot,
  gameService,
  gameRoutes,
};
