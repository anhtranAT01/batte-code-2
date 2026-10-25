const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');

dotenv.config();

const path = require('path');

const { pool, checkDbConnection } = require('./config/db');
const authRoutes = require('./auth/auth.routes');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CORS_ORIGINS = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

function isAllowedOrigin(origin) {
  return !origin || CORS_ORIGINS.includes('*') || CORS_ORIGINS.includes(origin.replace(/\/$/, ''));
}

const corsOrigin = (origin, callback) => {
  if (isAllowedOrigin(origin)) return callback(null, true);
  return callback(new Error(`Origin ${origin} is not allowed by CORS`));
};

// WebSocket setup optimized for Cloudflare Tunnel
// Cloudflare Tunnel drops idle WebSocket connections after 100 seconds.
// A 15-second heartbeat ensures persistent zero-drop connectivity.
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingInterval: 15000, // 15 seconds heartbeat to keep Cloudflare tunnel alive
  pingTimeout: 10000,  // 10 seconds timeout
  transports: ['websocket', 'polling'],
  allowEIO3: true,
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allows flexible integration with external frontend assets
}));
app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));
app.use(express.json({limit:'3mb'}));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const fs = require('fs');

// Static files for Frontend UI (Production build or raw source)
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
const frontendPath = path.join(__dirname, '../../frontend');
const staticPath = fs.existsSync(frontendDistPath) ? frontendDistPath : frontendPath;
const frontendIndexPath = path.join(staticPath, 'index.html');
const hasBundledFrontend = fs.existsSync(frontendIndexPath);

if (hasBundledFrontend) {
  app.use(express.static(staticPath));
}

// API Routes
const gameRoutes = require('./game/gameRoutes');
const botRoutes = require('./bot/bot.routes');
const tournamentRoutes = require('./tournament/tournament.routes');
const adminRoutes = require('./admin/admin.routes');
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/bots', botRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/support',require('./support/support.routes'));

// System Health Check
app.get('/api/health', async (req, res) => {
  const health=await require('./support/systemHealth').check();
  res.set('Cache-Control','no-store').status(health.database==='online'?200:503).json(health);
});

// Real-time WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Heartbeat ping from client
  socket.on('cf:ping', () => {
    socket.emit('cf:pong', { timestamp: Date.now() });
  });

  // Join a match room to watch live RPS battles
  socket.on('match:join', ({ matchId }) => {
    if (matchId) {
      socket.join(`match:${matchId}`);
      console.log(`[Socket.io] Client ${socket.id} joined room match:${matchId}`);
      socket.emit('match:joined', { matchId, status: 'LISTENING' });
    }
  });

  // Leave a match room
  socket.on('match:leave', ({ matchId }) => {
    if (matchId) {
      socket.leave(`match:${matchId}`);
      console.log(`[Socket.io] Client ${socket.id} left room match:${matchId}`);
    }
  });

  // Broadcast online user count
  io.emit('online:count', { count: io.engine.clientsCount });

  // Questions use authenticated, owner-scoped REST routes; no public message broadcast.

  socket.on('disconnect', (reason) => {
    console.log(`[Socket.io] Client disconnected: ${socket.id} (Reason: ${reason})`);
    io.emit('online:count', { count: io.engine.clientsCount });
  });
});

// Attach io instance to express app so routes can broadcast events
app.set('io', io);

// Serve frontend index.html for non-API web navigation
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      message: `Endpoint ${req.method} ${req.originalUrl} không tồn tại trên hệ thống.`,
    });
  }
  if (hasBundledFrontend) {
    return res.sendFile(frontendIndexPath);
  }

  return res.status(200).json({
    service: 'Battle Code API',
    status: 'RUNNING',
    health: '/api/health',
    frontend: process.env.FRONTEND_URL || null,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Lỗi máy chủ nội bộ. Vui lòng thử lại sau.',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// Start Server
server.listen(PORT, async () => {
  console.log(`=======================================================`);
  console.log(` RPS Tactical Arena Backend running on port ${PORT}`);
  console.log(` Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(` Cloudflare WebSockets KeepAlive: 15s interval`);
  console.log(`=======================================================`);
  await checkDbConnection();
  require('./support/submissionQueue').start();
});

// Graceful Shutdown
function handleShutdown(signal) {
  console.log(`\n[Process] Received ${signal}. Gracefully closing server and database pool...`);
  require('./game/duelExecutor').shutdown().catch(console.error);
  require('./support/submissionQueue').stop();
  server.close(async () => {
    try {
      await pool.end();
      console.log('[PostgreSQL] Connection pool closed.');
      process.exit(0);
    } catch (err) {
      console.error('[Shutdown Error]:', err);
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

module.exports = { app, server, io };
