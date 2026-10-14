import pino from 'pino';
import { createApp } from './app.js';
import { createPublisher } from './publisher.js';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const port = Number(process.env.PORT ?? 4000);

const { app, server } = await createApp({
  schedulingUrl: process.env.SCHEDULING_URL ?? 'http://localhost:8081',
  crewUrl: process.env.CREW_URL ?? 'http://localhost:8082',
  corsOrigin: process.env.CORS_ORIGIN?.split(','),
  publisher: createPublisher({ bucket: process.env.CALLSHEET_BUCKET, logger }),
});

const http = app.listen(port, () => logger.info({ port }, 'gateway listening at /graphql'));

const shutdown = async () => {
  await server.stop();
  http.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
