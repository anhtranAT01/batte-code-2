const Redis = require('ioredis');
const { Queue } = require('bullmq');
const dotenv = require('dotenv');

dotenv.config();

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
};

if (process.env.REDIS_PASSWORD) redisConfig.password = process.env.REDIS_PASSWORD;

const redisConnection = new Redis(redisConfig);

redisConnection.on('connect', () => {
  console.log('[Redis] Connected successfully to Redis server');
});

redisConnection.on('error', (err) => {
  console.error('[Redis Error]:', err.message);
});

// BullMQ Queue for distributing match execution to judge-worker instances
const matchQueue = new Queue('match-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      count: 500,
    },
    removeOnFail: {
      count: 1000,
    },
  },
});

module.exports = {
  redisConnection,
  redisConfig,
  matchQueue,
};
