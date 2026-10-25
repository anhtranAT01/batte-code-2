const fs = require('fs');
const path = require('path');

const STORAGE_ROOT = process.env.BOT_STORAGE_ROOT
  ? path.resolve(process.env.BOT_STORAGE_ROOT)
  : path.resolve(__dirname, '../../../storage/bots');

function existingBotPath(bot) {
  const recorded = bot.file_path_or_git_url || '';
  if (recorded && fs.existsSync(recorded) && fs.statSync(recorded).isFile()) return recorded;
  // Databases can contain paths from an earlier Windows checkout/container.
  const parts = recorded.replace(/\\/g, '/').split('/');
  const sampleIndex = parts.lastIndexOf('sample-bots');
  if (sampleIndex >= 0 && sampleIndex === parts.length - 2) {
    const bundled = path.join(__dirname, '../../../sample-bots', parts.at(-1));
    if (fs.existsSync(bundled) && fs.statSync(bundled).isFile()) return bundled;
  }
  if (bot.user_id && parts.at(-1)) {
    const stored = path.join(STORAGE_ROOT, String(bot.user_id), parts.at(-1));
    if (fs.existsSync(stored) && fs.statSync(stored).isFile()) return stored;
  }
  return null;
}

function isBotAvailable(bot) {
  return Boolean(existingBotPath(bot) || (bot.source_type === 'file' && bot.source_code));
}

function resolveBotPath(bot) {
  const existing = existingBotPath(bot);
  if (existing) return existing;
  if (bot.source_type === 'file' && bot.source_code) {
    const userDir = path.join(STORAGE_ROOT, String(bot.user_id));
    fs.mkdirSync(userDir, { recursive: true });
    const restored = path.join(userDir, `${bot.id}.py`);
    fs.writeFileSync(restored, bot.source_code, 'utf8');
    return restored;
  }
  const error = new Error(`Bot "${bot.name}" đã được chọn nhưng file không còn trên máy chủ. Vào Kho bot và tải lại file .py (hoặc nộp lại repository Git).`);
  error.statusCode = 422;
  throw error;
}

module.exports = { STORAGE_ROOT, existingBotPath, isBotAvailable, resolveBotPath };
