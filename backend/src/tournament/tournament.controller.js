/**
 * Tournament Controller - HTTP Request Handlers
 */

const tournamentService = require('./tournament.service');
const { generateTournamentExcel, generateTournamentCSV } = require('./tournamentExport');
const matchmakingService = require('./matchmaking.service');

async function createTournament(req, res, next) {
  try {
    const { name, maxParticipants, settings } = req.body;
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Tên giải đấu không được để trống.',
      });
    }

    const tourney = await tournamentService.createTournament({
      name,
      maxParticipants: maxParticipants ? parseInt(maxParticipants, 10) : 1000,
      settings,
    });

    return res.status(201).json({
      success: true,
      message: 'Khởi tạo giải đấu thành công!',
      data: tourney,
    });
  } catch (err) {
    next(err);
  }
}

async function register(req, res, next) {
  try {
    const { id } = req.params;
    const { botId, teamName } = req.body;
    const userId = req.user.id;

    const result = await tournamentService.registerStudent({
      tournamentId: id,
      userId,
      botId,
      teamName,
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function updateTeam(req, res, next) {
  try {
    const userId = req.user.id;
    const { teamName, tournamentId } = req.body;
    const result = await tournamentService.updateUserTeam({
      userId,
      teamName,
      tournamentId,
    });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function getTeams(req, res, next) {
  try {
    const { tournamentId } = req.query;
    const teams = await tournamentService.getTournamentTeams(tournamentId);
    return res.status(200).json({
      success: true,
      data: teams,
    });
  } catch (err) {
    next(err);
  }
}

async function start(req, res, next) {
  try {
    const { id } = req.params;
    const result = await tournamentService.startTournament(id);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function getStandings(req, res, next) {
  try {
    const { id } = req.params;
    const result = await tournamentService.getTournamentStandings(id);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function exportExcel(req, res, next) {
  try {
    const { id } = req.params;
    const { tournament, standings } = await tournamentService.getTournamentStandings(id);

    const buffer = await generateTournamentExcel(tournament, standings);

    const filename = `Tournament_${tournament.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_Results.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    return res.send(buffer);
  } catch (err) {
    next(err);
  }
}

async function exportCSV(req, res, next) {
  try {
    const { id } = req.params;
    const { tournament, standings } = await tournamentService.getTournamentStandings(id);

    const csvData = generateTournamentCSV(tournament, standings);

    const filename = `Tournament_${tournament.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_Results.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.send(csvData);
  } catch (err) {
    next(err);
  }
}

// Matchmaking Queue Handlers
async function joinQueue(req, res, next) {
  try {
    const userId = req.user.id;
    const { botId } = req.body;
    const result = await matchmakingService.joinMatchmaking({ userId, botId });
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function leaveQueue(req, res, next) {
  try {
    const userId = req.user.id;
    const result = matchmakingService.leaveMatchmaking(userId);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function updateSchedule(req, res, next) {
  try {
    const { id } = req.params;
    const { scheduledStartAt } = req.body;
    const result = await tournamentService.updateTournamentSchedule(id, scheduledStartAt);
    return res.status(200).json({
      success: true,
      message: 'Cập nhật lịch bắt đầu giải đấu thành công!',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function updateBrackets(req, res, next) {
  try {
    const { id } = req.params;
    const { brackets } = req.body;
    const result = await tournamentService.updateTournamentBrackets(id, brackets);
    return res.status(200).json({
      success: true,
      message: 'Admin đã cập nhật phân nhánh giải đấu thành công!',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function getTournaments(req, res, next) {
  try {
    const tourneys = await tournamentService.listTournaments();
    return res.status(200).json({
      success: true,
      data: tourneys,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createTournament,
  register,
  start,
  getStandings,
  exportExcel,
  exportCSV,
  joinQueue,
  leaveQueue,
  updateSchedule,
  updateBrackets,
  getTournaments,
  updateTeam,
  getTeams,
};
