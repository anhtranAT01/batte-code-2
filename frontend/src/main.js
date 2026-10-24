/**
 * Tactical Rock-Paper-Scissors Arena Client Application
 * Connects to Node.js Backend & Cloudflare Tunnel via WebSockets
 */

const API_BASE = 'http://localhost:5000/api';

// Board Configuration (8x8)
const ROWS = 8;
const COLS = 8;

const PIECE_ICONS = {
  R: '🪨', // Rock
  P: '📄', // Paper
  S: '✂️', // Scissors
  F: '🚩', // Flag
};

let currentBoard = [];
let authMode = 'REGISTER'; // 'REGISTER' | 'LOGIN'
let currentUser = null;

// Initialize initial board pieces
function createDefaultBoard() {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

  // Player 1 Pieces (Blue)
  const p1Spawns = [
    { r: 0, c: 0, type: 'R', player: 1 },
    { r: 0, c: 1, type: 'P', player: 1 },
    { r: 0, c: 2, type: 'S', player: 1 },
    { r: 0, c: 3, type: 'F', player: 1 },
    { r: 0, c: 4, type: 'R', player: 1 },
    { r: 0, c: 5, type: 'P', player: 1 },
    { r: 0, c: 6, type: 'S', player: 1 },
    { r: 0, c: 7, type: 'R', player: 1 },
  ];

  // Player 2 Pieces (Red)
  const p2Spawns = [
    { r: 7, c: 0, type: 'R', player: 2 },
    { r: 7, c: 1, type: 'P', player: 2 },
    { r: 7, c: 2, type: 'S', player: 2 },
    { r: 7, c: 3, type: 'R', player: 2 },
    { r: 7, c: 4, type: 'F', player: 2 },
    { r: 7, c: 5, type: 'P', player: 2 },
    { r: 7, c: 6, type: 'S', player: 2 },
    { r: 7, c: 7, type: 'R', player: 2 },
  ];

  // Obstacles in middle
  grid[3][3] = { type: 'OBSTACLE', player: 0 };
  grid[3][4] = { type: 'OBSTACLE', player: 0 };
  grid[4][3] = { type: 'OBSTACLE', player: 0 };
  grid[4][4] = { type: 'OBSTACLE', player: 0 };

  for (const p of p1Spawns) grid[p.r][p.c] = p;
  for (const p of p2Spawns) grid[p.r][p.c] = p;

  return grid;
}

function renderBoard() {
  const boardEl = document.getElementById('gameBoard');
  boardEl.innerHTML = '';

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cellEl = document.createElement('div');
      cellEl.classList.add('board-cell');
      cellEl.dataset.row = r;
      cellEl.dataset.col = c;

      const piece = currentBoard[r][c];
      if (piece) {
        if (piece.type === 'OBSTACLE') {
          cellEl.classList.add('obstacle');
          cellEl.textContent = '⬛';
        } else {
          cellEl.classList.add(piece.player === 1 ? 'piece-p1' : 'piece-p2');
          cellEl.textContent = PIECE_ICONS[piece.type] || piece.type;
          cellEl.title = `Người chơi ${piece.player}: ${piece.type}`;
        }
      }

      boardEl.appendChild(cellEl);
    }
  }
}

// Interactive Demo Simulation
let simulationTimer = null;
function runDemoSimulation() {
  if (simulationTimer) clearInterval(simulationTimer);

  let step = 0;
  simulationTimer = setInterval(() => {
    step++;
    const indicator = document.getElementById('turnIndicator');
    indicator.textContent = `Lượt: ${step % 2 === 1 ? 'Người chơi 1 (Blue)' : 'Người chơi 2 (Red)'} | Bước: #${step}`;

    // Random simple advance
    const p1Pieces = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const item = currentBoard[r][c];
        if (item && item.player === 1 && item.type !== 'F') {
          p1Pieces.push({ r, c, item });
        }
      }
    }

    if (p1Pieces.length > 0 && step <= 10) {
      const chosen = p1Pieces[Math.floor(Math.random() * p1Pieces.length)];
      if (chosen.r + 1 < ROWS && !currentBoard[chosen.r + 1][chosen.c]) {
        currentBoard[chosen.r + 1][chosen.c] = chosen.item;
        currentBoard[chosen.r][chosen.c] = null;
        renderBoard();
      }
    }

    if (step > 15) {
      clearInterval(simulationTimer);
      indicator.textContent = 'Trận đấu kết thúc! Sẵn sàng cho vòng kế tiếp.';
    }
  }, 600);
}

// Authentication Modal and Handlers
const authModal = document.getElementById('authModal');
const btnOpenAuth = document.getElementById('btnOpenAuth');
const btnCloseModal = document.getElementById('btnCloseModal');
const tabRegister = document.getElementById('tabRegister');
const tabLogin = document.getElementById('tabLogin');
const roleGroup = document.getElementById('roleGroup');
const btnSubmitAuth = document.getElementById('btnSubmitAuth');
const authForm = document.getElementById('authForm');
const authMessage = document.getElementById('authMessage');
const modalTitle = document.getElementById('modalTitle');

function setAuthMode(mode) {
  authMode = mode;
  authMessage.classList.add('hidden');
  if (mode === 'REGISTER') {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    roleGroup.style.display = 'block';
    modalTitle.textContent = 'Đăng Ký Tài Khoản Học Sinh';
    btnSubmitAuth.textContent = 'Xác Nhận Đăng Ký';
  } else {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    roleGroup.style.display = 'none';
    modalTitle.textContent = 'Đăng Nhập Hệ Thống';
    btnSubmitAuth.textContent = 'Đăng Nhập';
  }
}

function showAuthMessage(type, text) {
  authMessage.className = `auth-msg ${type}`;
  authMessage.textContent = text;
  authMessage.classList.remove('hidden');
}

btnOpenAuth?.addEventListener('click', () => {
  authModal.classList.remove('hidden');
});

btnCloseModal?.addEventListener('click', () => {
  authModal.classList.add('hidden');
});

tabRegister?.addEventListener('click', () => setAuthMode('REGISTER'));
tabLogin?.addEventListener('click', () => setAuthMode('LOGIN'));

authForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('usernameInput').value.trim();
  const password = document.getElementById('passwordInput').value;
  const role = document.getElementById('roleInput').value;

  const endpoint = authMode === 'REGISTER' ? `${API_BASE}/auth/register` : `${API_BASE}/auth/login`;
  const payload = authMode === 'REGISTER' ? { username, password, role } : { username, password };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data.errors ? data.errors.join(', ') : (data.message || 'Có lỗi xảy ra.');
      showAuthMessage('error', msg);
      return;
    }

    // Save token and update state
    localStorage.setItem('rps_token', data.data.token);
    currentUser = data.data.user;

    showAuthMessage('success', `${data.message} Xin chào ${currentUser.username}!`);
    setTimeout(() => {
      authModal.classList.add('hidden');
      updateNavUser();
    }, 1000);
  } catch (err) {
    showAuthMessage('error', 'Không thể kết nối đến máy chủ Backend.');
  }
});

function updateNavUser() {
  const authStatus = document.getElementById('authStatus');
  if (currentUser) {
    authStatus.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px;">
        <span>👤 <strong>${currentUser.username}</strong> (Elo: ${currentUser.elo_rating})</span>
        <button id="btnLogout" class="btn btn-secondary" style="padding:6px 12px; font-size:0.85rem;">Đăng Xuất</button>
      </div>
    `;
    document.getElementById('btnLogout')?.addEventListener('click', () => {
      localStorage.removeItem('rps_token');
      currentUser = null;
      location.reload();
    });
  }
}

// Auto check existing token
async function checkAuthOnLoad() {
  const token = localStorage.getItem('rps_token');
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      currentUser = data.data;
      updateNavUser();
    } else {
      localStorage.removeItem('rps_token');
    }
  } catch {
    // Network error or backend offline
  }
}

// Setup Event Listeners
document.getElementById('btnStartDemo')?.addEventListener('click', runDemoSimulation);
document.getElementById('btnResetBoard')?.addEventListener('click', () => {
  if (simulationTimer) clearInterval(simulationTimer);
  currentBoard = createDefaultBoard();
  renderBoard();
  document.getElementById('turnIndicator').textContent = 'Lượt: Người chơi 1';
});

// App Startup
currentBoard = createDefaultBoard();
renderBoard();
checkAuthOnLoad();
