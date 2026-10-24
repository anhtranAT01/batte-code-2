/**
 * Python Sandboxed Runner with Strict Timeout & Infinite Loop Protection
 */

const { spawn, execSync } = require('child_process');

/**
 * Kill process and its child tree safely
 */
function killProcessTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch {
    // Process may have already terminated
    try {
      process.kill(pid, 'SIGKILL');
    } catch {}
  }
}

/**
 * Execute a Python bot with strict timeout and capture move JSON
 * @param {Object} options
 * @param {string} options.botScriptPath - Absolute path to bot .py script
 * @param {Object} options.inputPayload - Game state object for STDIN
 * @param {number} [options.timeoutMs=1000] - Maximum turn execution time
 * @returns {Promise<{ success: boolean, move?: Object, durationMs: number, timedOut?: boolean, hasInfiniteLoop?: boolean, error?: string }>}
 */
function executePythonBot({ botScriptPath, inputPayload, timeoutMs = 1000 }) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

    let stdoutData = '';
    let stderrData = '';
    let timedOut = false;
    let resolved = false;

    // Spawn Python subprocess
    const child = spawn(pythonCmd, ['-u', botScriptPath], {
      detached: process.platform !== 'win32',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Timeout Watchdog - Triggers if bot enters while True or freezes
    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child.pid);
      if (!resolved) {
        resolved = true;
        const durationMs = Date.now() - startTime;
        resolve({
          success: false,
          timedOut: true,
          hasInfiniteLoop: true,
          durationMs,
          error: `TIMEOUT: Bot thực thi vượt quá thời gian tối đa ${timeoutMs}ms. Đã ngắt tiến trình! (Phát hiện lỗi lặp vô hạn / Infinite Loop)`,
        });
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      if (!resolved) {
        resolved = true;
        resolve({
          success: false,
          timedOut: false,
          hasInfiniteLoop: false,
          durationMs: Date.now() - startTime,
          error: `PROCESS_SPAWN_ERROR: ${err.message}`,
        });
      }
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (resolved) return;
      resolved = true;
      const durationMs = Date.now() - startTime;

      if (timedOut) {
        return resolve({
          success: false,
          timedOut: true,
          hasInfiniteLoop: true,
          durationMs,
          error: `TIMEOUT: Bot bị ngắt do vượt quá ${timeoutMs}ms (Lặp vô hạn).`,
        });
      }

      if (code !== 0) {
        return resolve({
          success: false,
          timedOut: false,
          hasInfiniteLoop: false,
          durationMs,
          error: `RUNTIME_ERROR (Exit code ${code}):\n${stderrData.trim() || 'Process crashed'}`,
        });
      }

      // Parse JSON output from STDOUT
      const cleanedOutput = stdoutData.trim();
      if (!cleanedOutput) {
        return resolve({
          success: false,
          timedOut: false,
          hasInfiniteLoop: false,
          durationMs,
          error: 'EMPTY_OUTPUT: Bot không in ra nước đi (STDOUT trống).',
        });
      }

      try {
        // Handle trailing lines: pick the last valid JSON line
        const lines = cleanedOutput.split('\n').map((l) => l.trim()).filter(Boolean);
        const lastLine = lines[lines.length - 1];
        const move = JSON.parse(lastLine);

        return resolve({
          success: true,
          move,
          durationMs,
          timedOut: false,
          hasInfiniteLoop: false,
        });
      } catch (parseErr) {
        return resolve({
          success: false,
          timedOut: false,
          hasInfiniteLoop: false,
          durationMs,
          error: `INVALID_JSON_OUTPUT: Kết quả in ra không phải JSON hợp lệ:\n"${cleanedOutput}"`,
        });
      }
    });

    // Send game state to Bot STDIN
    try {
      child.stdin.write(JSON.stringify(inputPayload) + '\n');
      child.stdin.end();
    } catch (writeErr) {
      clearTimeout(timer);
      killProcessTree(child.pid);
      if (!resolved) {
        resolved = true;
        resolve({
          success: false,
          timedOut: false,
          hasInfiniteLoop: false,
          durationMs: Date.now() - startTime,
          error: `STDIN_WRITE_ERROR: ${writeErr.message}`,
        });
      }
    }
  });
}

module.exports = {
  executePythonBot,
  killProcessTree,
};
