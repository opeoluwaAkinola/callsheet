import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { InMemoryCrewRepository } from '../src/repository.js';
import { SEED_CREW } from '../src/seed.js';

let app;
beforeEach(() => {
  app = createApp({ repo: new InMemoryCrewRepository(SEED_CREW) });
});

describe('GET /api/crew', () => {
  it('lists crew sorted by name with a total count header', async () => {
    const res = await request(app).get('/api/crew').expect(200);
    expect(res.body.total).toBe(SEED_CREW.length);
    expect(res.headers['x-total-count']).toBe(String(SEED_CREW.length));
    const names = res.body.items.map((m) => m.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('filters by department and free-text role search', async () => {
    const camera = await request(app).get('/api/crew').query({ department: 'Camera' }).expect(200);
    expect(camera.body.items.map((m) => m.id)).toEqual(['crew-004', 'crew-001']);

    const gaffers = await request(app).get('/api/crew').query({ q: 'gaffer' }).expect(200);
    expect(gaffers.body.items.map((m) => m.id)).toEqual(['crew-003']);
  });

  it('excludes crew who are unavailable on a given date', async () => {
    const res = await request(app).get('/api/crew').query({ availableOn: '2026-11-12' }).expect(200);
    expect(res.body.items.map((m) => m.id)).not.toContain('crew-003');
    expect(res.body.total).toBe(SEED_CREW.length - 1);
  });

  it('paginates', async () => {
    const res = await request(app).get('/api/crew').query({ limit: 3, offset: 3 }).expect(200);
    expect(res.body.items).toHaveLength(3);
    expect(res.body.offset).toBe(3);
  });

  it('rejects unknown departments with a problem response', async () => {
    const res = await request(app).get('/api/crew').query({ department: 'Catering' }).expect(400);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.body.errors[0].field).toBe('department');
  });
});

describe('GET /api/crew/batch', () => {
  it('returns only the ids that exist', async () => {
    const res = await request(app).get('/api/crew/batch').query({ ids: 'crew-001,crew-999,crew-005' }).expect(200);
    expect(res.body.map((m) => m.id)).toEqual(['crew-001', 'crew-005']);
  });

  it('requires ids', async () => {
    await request(app).get('/api/crew/batch').expect(400);
  });
});

describe('availability', () => {
  it('reports per-date availability', async () => {
    const busy = await request(app).get('/api/crew/crew-006/availability').query({ date: '2026-11-02' }).expect(200);
    expect(busy.body.available).toBe(false);
    const free = await request(app).get('/api/crew/crew-006/availability').query({ date: '2026-11-04' }).expect(200);
    expect(free.body.available).toBe(true);
  });

  it('validates the date format', async () => {
    await request(app).get('/api/crew/crew-006/availability').query({ date: 'tomorrow' }).expect(400);
  });
});

describe('POST /api/crew', () => {
  const valid = { name: 'Rosa Jimenez', department: 'Wardrobe', roles: ['Costume Designer'], email: 'rosa@example.com' };

  it('creates a member with a generated id', async () => {
    const res = await request(app).post('/api/crew').send(valid).expect(201);
    expect(res.body.id).toBe('crew-009');
    expect(res.headers.location).toBe('/api/crew/crew-009');
    expect(res.body.unavailable).toEqual([]);
  });

  it('rejects duplicate emails with 409', async () => {
    await request(app).post('/api/crew').send({ ...valid, email: 'maya.okafor@example.com' }).expect(409);
  });

  it('rejects inverted unavailability windows', async () => {
    const res = await request(app)
      .post('/api/crew')
      .send({ ...valid, unavailable: [{ from: '2026-12-10', to: '2026-12-01' }] })
      .expect(400);
    expect(res.body.errors[0].field).toBe('unavailable.0.to');
  });

  it('rejects malformed JSON', async () => {
    await request(app).post('/api/crew').set('content-type', 'application/json').send('{"name":').expect(400);
  });
});

describe('PATCH /api/crew/:id', () => {
  it('updates allowed fields', async () => {
    const res = await request(app).patch('/api/crew/crew-002').send({ roles: ['1st AD', 'UPM'] }).expect(200);
    expect(res.body.roles).toEqual(['1st AD', 'UPM']);
    expect(res.body.name).toBe('Dev Raman');
  });

  it('rejects unknown fields', async () => {
    await request(app).patch('/api/crew/crew-002').send({ salary: 1 }).expect(400);
  });

  it('404s for unknown members', async () => {
    await request(app).patch('/api/crew/crew-404').send({ name: 'X' }).expect(404);
  });
});

describe('health', () => {
  it('reports readiness from the injected check', async () => {
    const down = createApp({ repo: new InMemoryCrewRepository(), isReady: async () => false });
    await request(down).get('/health/ready').expect(503);
    await request(app).get('/health/ready').expect(200);
  });
});
