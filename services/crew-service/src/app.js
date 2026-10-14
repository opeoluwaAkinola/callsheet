import express from 'express';
import { pinoHttp } from 'pino-http';
import { ZodError } from 'zod';
import { crewInputSchema, crewPatchSchema, listQuerySchema, unavailabilitySchema, DEPARTMENTS } from './schemas.js';
import { isAvailableOn } from './availability.js';

class HttpError extends Error {
  constructor(status, title, detail) {
    super(detail);
    this.status = status;
    this.title = title;
  }
}

const notFound = (id) => new HttpError(404, 'Not found', `Crew member ${id} not found`);

/** Wraps async handlers so rejected promises reach the error middleware (Express 4). */
const handle = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function createApp({ repo, logger, isReady = async () => true }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  if (logger) app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url.startsWith('/health') } }));

  app.get('/health/live', (_req, res) => res.json({ status: 'UP' }));
  app.get('/health/ready', handle(async (_req, res) => {
    const ready = await isReady();
    res.status(ready ? 200 : 503).json({ status: ready ? 'UP' : 'DOWN' });
  }));

  app.get('/api/departments', (_req, res) => res.json(DEPARTMENTS));

  app.get('/api/crew', handle(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const { items, total } = await repo.list(query);
    res.set('X-Total-Count', String(total));
    res.json({ items, total, limit: query.limit, offset: query.offset });
  }));

  // Batch lookup used by the GraphQL gateway's DataLoader to avoid N+1 calls.
  app.get('/api/crew/batch', handle(async (req, res) => {
    const ids = String(req.query.ids ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0 || ids.length > 200) {
      throw new HttpError(400, 'Invalid request', 'ids must contain between 1 and 200 comma-separated ids');
    }
    res.json(await repo.getMany(ids));
  }));

  app.get('/api/crew/:id', handle(async (req, res) => {
    const member = await repo.get(req.params.id);
    if (!member) throw notFound(req.params.id);
    res.json(member);
  }));

  app.get('/api/crew/:id/availability', handle(async (req, res) => {
    const date = unavailabilitySchema.innerType().shape.from.parse(req.query.date);
    const member = await repo.get(req.params.id);
    if (!member) throw notFound(req.params.id);
    res.json({ id: member.id, date, available: isAvailableOn(member, date) });
  }));

  app.post('/api/crew', handle(async (req, res) => {
    const created = await repo.create(crewInputSchema.parse(req.body));
    res.status(201).location(`/api/crew/${created.id}`).json(created);
  }));

  app.patch('/api/crew/:id', handle(async (req, res) => {
    const updated = await repo.update(req.params.id, crewPatchSchema.parse(req.body));
    if (!updated) throw notFound(req.params.id);
    res.json(updated);
  }));

  app.use((_req, _res, next) => next(new HttpError(404, 'Not found', 'No such route')));

  // RFC 9457 problem+json, matching scheduling-service.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    let problem;
    if (err instanceof ZodError) {
      problem = {
        status: 400, title: 'Invalid request', detail: 'Validation failed',
        errors: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      };
    } else if (err instanceof HttpError) {
      problem = { status: err.status, title: err.title, detail: err.message };
    } else if (err?.code === 11000) {
      problem = { status: 409, title: 'Conflict', detail: 'A crew member with that email already exists' };
    } else if (err?.type === 'entity.parse.failed') {
      problem = { status: 400, title: 'Invalid request', detail: 'Malformed JSON body' };
    } else {
      req.log?.error({ err }, 'unhandled error');
      problem = { status: 500, title: 'Internal error', detail: 'Something went wrong' };
    }
    res.status(problem.status).type('application/problem+json').json({ ...problem, instance: req.originalUrl });
  });

  return app;
}
