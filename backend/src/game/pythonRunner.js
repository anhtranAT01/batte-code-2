/**
 * Python Sandboxed Runner with Strict Timeout & Infinite Loop Protection
 */

const { spawn, execSync } = require('child_process');

function getPythonCommand() {
  return process.env.PYTHON_EXECUTABLE || (process.platform === 'win32' ? 'python' : 'python3');
}

function killProcessTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {}
  }
}

function executePythonBot({ botScriptPath, inputPayload, timeoutMs = 1000 }) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const pythonCmd = getPythonCommand();

    let stdoutData = '';
    let stderrData = '';
    let timedOut = false;
    let resolved = false;

    const child = spawn(pythonCmd, ['-u', botScriptPath], {
      detached: process.platform !== 'win32',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

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
    // A script may exit before consuming stdin. Handle EPIPE without crashing
    // the server; the close handler still reports its actual stdout/stderr.
    child.stdin.on('error', () => {});

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

      const cleanedOutput = stdoutData.trim();
      if (!cleanedOutput) {
        return resolve({
          success: false,
          timedOut: false,
          hasInfiniteLoop: false,
          durationMs,
          error: `EMPTY_OUTPUT: File Python chạy xong nhưng không in nước đi. Hãy tải lại toàn bộ file .py, gồm đoạn if __name__ == "__main__": gọi hàm chính và print JSON.${stderrData.trim() ? ` Chi tiết: ${stderrData.trim()}` : ''}`,
        });
      }

      try {
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
  getPythonCommand,
};
