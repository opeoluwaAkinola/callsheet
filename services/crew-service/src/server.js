import { MongoClient } from 'mongodb';
import pino from 'pino';
import { createApp } from './app.js';
import { MongoCrewRepository } from './repository.js';
import { seedIfEmpty } from './seed.js';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const port = Number(process.env.PORT ?? 8082);
const mongoUrl = process.env.MONGO_URL ?? 'mongodb://localhost:27017';

const client = new MongoClient(mongoUrl, { serverSelectionTimeoutMS: 5000 });
await client.connect();
const repo = new MongoCrewRepository(client.db(process.env.MONGO_DB ?? 'callsheet'));
await repo.init();
if (process.env.SEED_DEMO_DATA !== 'false') await seedIfEmpty(repo, logger);

const isReady = async () => {
  try {
    await client.db('admin').command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
};

const server = createApp({ repo, logger, isReady }).listen(port, () => logger.info({ port }, 'crew-service listening'));

const shutdown = (signal) => {
  logger.info({ signal }, 'shutting down');
  server.close(() => client.close().then(() => process.exit(0)));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
