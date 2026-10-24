/**
 * Bot Service - Handles Python File Uploads, Git Clones, Syntax Validation & Database Persistence
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { query } = require('../config/db');

const STORAGE_ROOT = process.env.BOT_STORAGE_ROOT
  ? path.resolve(process.env.BOT_STORAGE_ROOT)
  : path.resolve(__dirname, '../../../storage/bots');

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
function validatePythonSyntax(filePath) {
  try {
    // Try python or python3
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    execSync(`${pythonCmd} -m py_compile "${filePath}"`, {
      timeout: 3000,
      stdio: 'pipe',
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
async function saveUploadedBot({ userId, botName, file }) {
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

  // Validate Python Syntax
  const syntaxCheck = validatePythonSyntax(targetPath);
  if (!syntaxCheck.valid) {
    // Remove invalid file
    try {
      fs.unlinkSync(targetPath);
    } catch {}
    const error = new Error(`Code Python có lỗi cú pháp (SyntaxError):\n${syntaxCheck.error}`);
    error.statusCode = 400;
    throw error;
  }

  // Insert into Bots table
  const insertSql = `
    INSERT INTO "Bots" (user_id, name, source_type, file_path_or_git_url, status, error_count)
    VALUES ($1, $2, 'file', $3, 'active', 0)
    RETURNING id, user_id, name, source_type, file_path_or_git_url, status, error_count, created_at;
  `;
  const res = await query(insertSql, [userId, botName || file.originalname, targetPath]);
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
  const repoPath = path.join(userDir, repoDirName);

  try {
    console.log(`[BotService] Cloning ${gitUrl} into ${repoPath}...`);
    execSync(`git clone --depth 1 "${gitUrl}" "${repoPath}"`, {
      timeout: 15000,
      stdio: 'pipe',
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
      fs.rmSync(repoPath, { recursive: true, force: true });
    } catch {}
    const error = new Error('Không tìm thấy file Python (.py) nào trong thư mục gốc của repository (Cần bot.py hoặc main.py).');
    error.statusCode = 400;
    throw error;
  }

  // Validate syntax
  const syntaxCheck = validatePythonSyntax(entrypoint);
  if (!syntaxCheck.valid) {
    try {
      fs.rmSync(repoPath, { recursive: true, force: true });
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
  const res = await query(insertSql, [userId, botName || path.basename(gitUrl, '.git'), entrypoint]);
  return res.rows[0];
}

/**
 * Get all bots belonging to a user
 */
async function getUserBots(userId) {
  const sql = `
    SELECT b.*,
           COUNT(m.id)::int AS total_matches,
           COUNT(CASE WHEN m.winner_id = b.user_id THEN 1 END)::int AS matches_won
    FROM "Bots" b
    LEFT JOIN "Matches" m ON m.player1_bot_id = b.id OR m.player2_bot_id = b.id
    WHERE b.user_id = $1
    GROUP BY b.id
    ORDER BY b.created_at DESC;
  `;
  const res = await query(sql, [userId]);
  return res.rows;
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

  // Deactivate all bots for user
  await query('UPDATE "Bots" SET is_active = false WHERE user_id = $1', [userId]);

  // Activate chosen bot
  const res = await query(
    'UPDATE "Bots" SET is_active = true WHERE id = $1 RETURNING *',
    [botId]
  );
  return res.rows[0];
}

/**
 * Create a new bot from raw Python code or chosen template
 */
async function createCodeBot({ userId, botName, code, tactic = 'FLAG_RUSHER' }) {
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
  const syntaxCheck = validatePythonSyntax(targetPath);
  if (!syntaxCheck.valid) {
    try {
      fs.unlinkSync(targetPath);
    } catch {}
    const error = new Error(`Code Python có lỗi cú pháp (SyntaxError):\n${syntaxCheck.error}`);
    error.statusCode = 400;
    throw error;
  }

  // Deactivate others if this is the first bot
  const existingBots = await query('SELECT id FROM "Bots" WHERE user_id = $1', [userId]);
  const shouldBeActive = existingBots.rows.length === 0;

  const insertSql = `
    INSERT INTO "Bots" (user_id, name, source_type, file_path_or_git_url, status, error_count, is_active, tactic)
    VALUES ($1, $2, 'file', $3, 'active', 0, $4, $5)
    RETURNING id, user_id, name, source_type, file_path_or_git_url, status, error_count, is_active, tactic, created_at;
  `;
  const res = await query(insertSql, [userId, botName || 'Bot Chiến Thuật', targetPath, shouldBeActive, tactic]);
  return res.rows[0];
}

/**
 * Update bot tactic (Chiến thuật)
 */
async function updateBotTactic(botId, userId, tactic) {
  const bot = await getBotById(botId, userId);
  if (!bot) {
    const error = new Error('Không tìm thấy Bot của bạn.');
    error.statusCode = 404;
    throw error;
  }

  const validTactics = ['FLAG_RUSHER', 'FLAG_DEFENDER', 'COMBAT_HUNTER', 'POTION_COLLECTOR'];
  const assignedTactic = validTactics.includes(tactic) ? tactic : 'FLAG_RUSHER';

  const res = await query(
    'UPDATE "Bots" SET tactic = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [assignedTactic, botId]
  );
  return res.rows[0];
}

/**
 * Get all active student bots across the community for PvP challenges
 */
async function getCommunityBots() {
  const sql = `
    SELECT b.id, b.user_id, b.name, b.tactic, b.source_type, b.status, b.is_active, b.created_at,
           u.username AS owner_name, u.elo_rating AS owner_elo
    FROM "Bots" b
    JOIN "Users" u ON u.id = b.user_id
    WHERE b.status = 'active'
    ORDER BY u.elo_rating DESC, b.created_at DESC;
  `;
  const res = await query(sql);
  return res.rows;
}

module.exports = {
  saveUploadedBot,
  saveGitBot,
  createCodeBot,
  updateBotTactic,
  getUserBots,
  getBotById,
  deleteBot,
  activateBot,
  validatePythonSyntax,
  getCommunityBots,
};
