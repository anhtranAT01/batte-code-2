/**
 * Bot Service - Handles Python File Uploads, Git Clones, Syntax Validation & Database Persistence
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const execFileAsync = require('node:util').promisify(execFile);
const { query } = require('../config/db');
const { STORAGE_ROOT, isBotAvailable, resolveBotPath } = require('./botStorage');
const { getPythonCommand } = require('../game/pythonRunner');
const { validateBotExecution } = require('./botValidation');

/**
 * Ensure storage directory exists
 */
function ensureUserStorageDir(userId) {
  const userDir = path.join(STORAGE_ROOT, String(userId));
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  return userDir;
}

/**
 * Verify Python syntax using `python -m py_compile`
 * @param {string} filePath
 */
async function validatePythonSyntax(filePath) {
  try {
    // Try python or python3
    await execFileAsync(getPythonCommand(), ['-m','py_compile',filePath], {
      timeout: 3000,
      windowsHide: true,
    });
    return { valid: true };
  } catch (err) {
    const errorOutput = err.stderr ? err.stderr.toString() : err.message;
    return { valid: false, error: errorOutput };
  }
}

/**
 * Save an uploaded Python bot file
 */
async function saveUploadedBot({ userId, botName, file, tactic = 'FLAG_RUSHER' }) {
  if (!file) {
    const error = new Error('Vui lòng chọn file Python (.py) để tải lên.');
    error.statusCode = 400;
    throw error;
  }

  const userDir = ensureUserStorageDir(userId);
  const safeFileName = `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const targetPath = path.join(userDir, safeFileName);

  // Move uploaded file to user directory
  fs.copyFileSync(file.path, targetPath);
  try {
    fs.unlinkSync(file.path); // Remove temp file
  } catch {}

  if (!fs.readFileSync(targetPath,'utf8').replace(/^\uFEFF/,'').trim()) {
    fs.unlinkSync(targetPath);
    const error = new Error('File Python đang rỗng. Hãy chọn file .py chứa toàn bộ mã nguồn bot.');
    error.statusCode = 400;
    throw error;
  }

  // Validate Python Syntax
  const syntaxCheck = await validatePythonSyntax(targetPath);
  if (!syntaxCheck.valid) {
    // Remove invalid file
    try {
      fs.unlinkSync(targetPath);
    } catch {}
    const error = new Error(`Code Python có lỗi cú pháp (SyntaxError):\n${syntaxCheck.error}`);
    error.statusCode = 400;
    throw error;
  }

  try { await validateBotExecution(targetPath); }
  catch (error) { try { fs.unlinkSync(targetPath); } catch {} throw error; }

  // Insert only after the uploaded source produces legal moves for both sides.
  const insertSql = `
    INSERT INTO "Bots" (user_id, name, source_type, file_path_or_git_url, status, error_count, source_code, is_active, tactic)
    VALUES ($1, $2, 'file', $3, 'active', 0, $4,
      NOT EXISTS (SELECT 1 FROM "Bots" WHERE user_id = $1 AND is_active = true), $5)
    RETURNING id, user_id, name, source_type, file_path_or_git_url, status, error_count, is_active, tactic, created_at;
  `;
  const res = await query(insertSql, [userId, botName || file.originalname, targetPath, fs.readFileSync(targetPath,'utf8'), tactic]);
  return res.rows[0];
}

/**
 * Clone a Git repository and locate the entrypoint bot file
 */
async function saveGitBot({ userId, botName, gitUrl }) {
  if (!gitUrl || (!gitUrl.startsWith('https://') && !gitUrl.startsWith('http://'))) {
    const error = new Error('URL Git không hợp lệ. Vui lòng cung cấp link HTTP/HTTPS (ví dụ: https://github.com/user/rps-bot.git)');
    error.statusCode = 400;
    throw error;
  }

  const userDir = ensureUserStorageDir(userId);
  const repoDirName = `git_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const repoPath = path.resolve(userDir, repoDirName);
  if(path.dirname(repoPath)!==path.resolve(userDir))throw new Error('Invalid repository storage path');

  try {
    console.log(`[BotService] Cloning ${gitUrl} into ${repoPath}...`);
    await execFileAsync('git',['clone','--depth','1','--',gitUrl,repoPath], {
      timeout: 15000,
      windowsHide: true,
      env:{...process.env,GIT_TERMINAL_PROMPT:'0'},
    });
  } catch (gitErr) {
    const error = new Error(`Không thể git clone kho lưu trữ: ${gitErr.stderr ? gitErr.stderr.toString() : gitErr.message}`);
    error.statusCode = 400;
    throw error;
  }

  // Locate python entrypoint: bot.py, main.py, or any .py file in root
  const candidates = ['bot.py', 'main.py', 'student_bot.py'];
  let entrypoint = null;

  for (const c of candidates) {
    const candidatePath = path.join(repoPath, c);
    if (fs.existsSync(candidatePath)) {
      entrypoint = candidatePath;
      break;
    }
  }

  if (!entrypoint) {
    // Find first .py file in repo
    const files = fs.readdirSync(repoPath);
    const pyFile = files.find((f) => f.endsWith('.py'));
    if (pyFile) {
      entrypoint = path.join(repoPath, pyFile);
    }
  }

  if (!entrypoint) {
    try {
      await fs.promises.rm(repoPath, { recursive: true, force: true });
    } catch {}
    const error = new Error('Không tìm thấy file Python (.py) nào trong thư mục gốc của repository (Cần bot.py hoặc main.py).');
    error.statusCode = 400;
    throw error;
  }

  // Validate syntax
  const syntaxCheck = await validatePythonSyntax(entrypoint);
  if (!syntaxCheck.valid) {
    try {
      await fs.promises.rm(repoPath, { recursive: true, force: true });
    } catch {}
    const error = new Error(`File ${path.basename(entrypoint)} có lỗi cú pháp Python:\n${syntaxCheck.error}`);
    error.statusCode = 400;
    throw error;
  }

  const insertSql = `
    INSERT INTO "Bots" (user_id, name, source_type, file_path_or_git_url, status, error_count)
    VALUES ($1, $2, 'git', $3, 'active', 0)
    RETURNING id, user_id, name, source_type, file_path_or_git_url, status, error_count, created_at;
  `;
  await validateBotExecution(entrypoint);
  const res = await query(insertSql, [userId, botName || path.basename(gitUrl, '.git'), entrypoint]);
  return res.rows[0];
}

/**
 * Get all bots belonging to a user
 */
async function getUserBots(userId) {
  const sql = `
    SELECT b.id,b.user_id,b.name,b.source_type,b.file_path_or_git_url,b.status,b.error_count,
           b.is_active,b.tactic,b.created_at,b.updated_at,
           (b.source_type='file' AND octet_length(b.source_code)>0) AS has_source,
           stats.total_matches,stats.matches_won
    FROM "Bots" b
    CROSS JOIN LATERAL (
      SELECT COUNT(*)::int AS total_matches,
             COUNT(*) FILTER(WHERE m.winner_id=b.user_id)::int AS matches_won
      FROM (
        SELECT winner_id FROM "Matches" WHERE player1_bot_id=b.id
        UNION ALL
        SELECT winner_id FROM "Matches" WHERE player2_bot_id=b.id AND player1_bot_id IS DISTINCT FROM b.id
      ) m
    ) stats
    WHERE b.user_id = $1
    ORDER BY b.created_at DESC;
  `;
  const res = await query(sql, [userId]);
  return res.rows.map(({ source_code,has_source, ...bot }) => ({ ...bot, is_available:Boolean(has_source || isBotAvailable({...bot,source_code})) }));
}

/**
 * Get single bot by ID
 */
async function getBotById(botId, userId = null) {
  const sql = userId
    ? 'SELECT * FROM "Bots" WHERE id = $1 AND user_id = $2 LIMIT 1'
    : 'SELECT * FROM "Bots" WHERE id = $1 LIMIT 1';
  const params = userId ? [botId, userId] : [botId];
  const res = await query(sql, params);
  return res.rows[0] || null;
}

/**
 * Delete a bot
 */
async function deleteBot(botId, userId) {
  const bot = await getBotById(botId, userId);
  if (!bot) {
    const error = new Error('Không tìm thấy bot để xóa hoặc bạn không có quyền.');
    error.statusCode = 404;
    throw error;
  }

  // Remove file from disk
  try {
    if (fs.existsSync(bot.file_path_or_git_url)) {
      fs.unlinkSync(bot.file_path_or_git_url);
    }
  } catch {}

  await query('DELETE FROM "Bots" WHERE id = $1', [botId]);
  return { success: true, message: 'Đã xóa Bot thành công.' };
}

/**
 * Set a bot as active for the student
 */
async function activateBot(botId, userId) {
  const bot = await getBotById(botId, userId);
  if (!bot) {
    const error = new Error('Không tìm thấy Bot của bạn.');
    error.statusCode = 404;
    throw error;
  }

  if (!isBotAvailable(bot)) {
    const error = new Error('File bot không còn trên máy chủ. Hãy nộp lại file trước khi chọn làm bot chính.');
    error.statusCode = 422;
    throw error;
  }
  await validateBotExecution(resolveBotPath(bot));
  // One statement changes the owner's official bot; callers cannot activate
  // another player's bot or leave multiple choices through a partial update.
  const res = await query(
    'UPDATE "Bots" SET is_active = (id = $1), updated_at = NOW() WHERE user_id = $2 RETURNING *',
    [botId, userId]
  );
  const {source_code, ...selected} = res.rows.find(row => row.id === botId);
  return selected;
}

/** List players independently of bot readiness so a missing bot never hides a person. */
async function getPlayers() {
  const result = await query(`
    SELECT u.id, u.username, u.elo_rating, b.id AS bot_id, b.name AS bot_name,
           b.user_id, b.source_type, b.file_path_or_git_url, b.has_source
    FROM "Users" u
    LEFT JOIN LATERAL (
      SELECT id,name,user_id,source_type,file_path_or_git_url,updated_at,
        (source_type='file' AND octet_length(source_code)>0) AS has_source
      FROM "Bots" WHERE user_id = u.id AND is_active = true AND status = 'active'
      ORDER BY updated_at DESC, id LIMIT 1
    ) b ON true
    ORDER BY u.elo_rating DESC, u.username, u.id
  `);
  return result.rows.map(row => {
    const ready = Boolean(row.bot_id && (row.has_source || isBotAvailable({...row,id:row.bot_id})));
    return {id:row.id,username:row.username,elo_rating:row.elo_rating,
      bot:row.bot_id ? {id:row.bot_id,name:row.bot_name} : null,
      ready, reason:ready ? null : row.bot_id ? 'Bot chính cần tải lại file.' : 'Người chơi chưa chọn bot chính.'};
  });
}

/**
 * Create a new bot from raw Python code or chosen template
 */
async function createCodeBot({ userId, botName, code, tactic = 'FLAG_RUSHER', botId, validated = false }) {
  if (!code || typeof code !== 'string' || !code.trim()) {
    const error = new Error('Nội dung mã nguồn Python không được để trống.');
    error.statusCode = 400;
    throw error;
  }

  const userDir = ensureUserStorageDir(userId);
  const cleanName = (botName || 'Custom_Bot').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeFileName = `${Date.now()}_${cleanName}.py`;
  const targetPath = path.join(userDir, safeFileName);

  fs.writeFileSync(targetPath, code, 'utf-8');

  // Validate syntax
  const syntaxCheck = validated ? {valid:true} : await validatePythonSyntax(targetPath);
  if (!syntaxCheck.valid) {
    try {
      fs.unlinkSync(targetPath);
    } catch {}
    const error = new Error(`Code Python có lỗi cú pháp (SyntaxError):\n${syntaxCheck.error}`);
    error.statusCode = 400;
    throw error;
  }

  try { if (!validated) await validateBotExecution(targetPath); }
  catch (error) { try { fs.unlinkSync(targetPath); } catch {} throw error; }

  // Deactivate others if this is the first bot
  const existingBots = await query('SELECT id FROM "Bots" WHERE user_id = $1', [userId]);
  const shouldBeActive = existingBots.rows.length === 0;

  const insertSql = `
    INSERT INTO "Bots" (user_id, name, source_type, file_path_or_git_url, status, error_count, is_active, tactic, source_code, id)
    VALUES ($1, $2, 'file', $3, 'active', 0, $4, $5, $6, COALESCE($7::uuid,gen_random_uuid()))
    ON CONFLICT(id) DO NOTHING
    RETURNING id, user_id, name, source_type, file_path_or_git_url, status, error_count, is_active, tactic, created_at;
  `;
  const res = await query(insertSql, [userId, botName || 'Bot Chiến Thuật', targetPath, shouldBeActive, tactic, code, botId || null]);
  if (res.rows[0]) return res.rows[0];
  try { fs.unlinkSync(targetPath); } catch {}
  return (await query('SELECT id,name,is_active FROM "Bots" WHERE id=$1 AND user_id=$2',[botId,userId])).rows[0];
}

/**
 * Get all active student bots across the community for PvP challenges
 */
async function getCommunityBots() {
  const sql = `
    SELECT b.id, b.user_id, b.name, b.tactic, b.source_type, b.status, b.is_active, b.created_at,
           b.file_path_or_git_url,(b.source_type='file' AND octet_length(b.source_code)>0) AS has_source,
           u.username AS owner_name, u.elo_rating AS owner_elo
    FROM "Bots" b
    JOIN "Users" u ON u.id = b.user_id
    WHERE b.status = 'active'
    ORDER BY u.elo_rating DESC, b.created_at DESC;
  `;
  const res = await query(sql);
  return res.rows.map(({source_code,has_source,file_path_or_git_url,...bot}) => ({...bot,
    is_available:Boolean(has_source || isBotAvailable({...bot,source_code,file_path_or_git_url})),
  }));
}

module.exports = {
  saveUploadedBot,
  saveGitBot,
  createCodeBot,
  getUserBots,
  getBotById,
  deleteBot,
  activateBot,
  validatePythonSyntax,
  getCommunityBots,
  getPlayers,
};
