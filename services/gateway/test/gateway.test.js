import { beforeEach, describe, expect, it, vi } from 'vitest';
import { contextFactory, createApolloServer } from '../src/app.js';
import { createPublisher } from '../src/publisher.js';

const SCHED = 'http://scheduling';
const CREW = 'http://crew';

const json = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
});

const crew = {
  'crew-001': { id: 'crew-001', name: 'Maya Okafor', department: 'Camera', roles: ['DP'], email: 'm@example.com', unavailable: [] },
  'crew-003': { id: 'crew-003', name: 'Sam Whitfield', department: 'Grip & Electric', roles: ['Gaffer'], email: 's@example.com',
    unavailable: [{ from: '2026-11-10', to: '2026-11-14' }] },
};

const shootDay = {
  id: 1, productionId: 1, productionTitle: 'Northern Lights', unit: 'Main Unit', locationName: 'Stage 7',
  callAt: '2026-11-02T07:00:00', wrapAt: '2026-11-02T19:00:00', version: 0,
  assignments: [
    { id: 10, shootDayId: 1, crewMemberId: 'crew-001', role: 'DP' },
    { id: 11, shootDayId: 1, crewMemberId: 'crew-003', role: 'Gaffer' },
  ],
};

let fetchImpl;
let server;
let context;

beforeEach(async () => {
  fetchImpl = vi.fn(async (url, init = {}) => {
    const u = new URL(url);
    const key = `${init.method ?? 'GET'} ${u.origin}${u.pathname}`;
    switch (key) {
      case `GET ${SCHED}/api/shoot-days/1`: return json(200, shootDay);
      case `GET ${SCHED}/api/shoot-days/999`: return json(404, { title: 'Not found', detail: 'nope' });
      case `GET ${SCHED}/api/productions/1`: return json(200, { id: 1, title: 'Northern Lights', startDate: '2026-11-02', endDate: '2026-12-18' });
      case `GET ${CREW}/api/crew/batch`: return json(200, u.searchParams.get('ids').split(',').map((id) => crew[id]).filter(Boolean));
      case `POST ${SCHED}/api/shoot-days/2/assignments`: return json(409, {
        title: 'Scheduling conflict', detail: 'Crew member crew-001 has 1 scheduling conflict(s)', crewMemberId: 'crew-001',
        conflicts: [{ type: 'DOUBLE_BOOKED', message: 'Already booked', with: { shootDayId: 1, productionTitle: 'Northern Lights', unit: 'Main Unit', callAt: shootDay.callAt, wrapAt: shootDay.wrapAt } }],
      });
      case `POST ${SCHED}/api/shoot-days/3/assignments`: return json(201, { id: 12, shootDayId: 3, crewMemberId: 'crew-003', role: 'Gaffer' });
      case `PATCH ${SCHED}/api/shoot-days/1`: return json(409, { title: 'Stale update', detail: 'Shoot day 1 was changed by someone else' });
      default: throw new Error(`unexpected request ${key}`);
    }
  });
  server = createApolloServer();
  context = contextFactory({ schedulingUrl: SCHED, crewUrl: CREW, fetchImpl, publisher: createPublisher() });
});

async function run(query, variables) {
  const res = await server.executeOperation({ query, variables }, { contextValue: context() });
  return res.body.singleResult;
}

const callsTo = (path) => fetchImpl.mock.calls.filter(([url]) => new URL(url).pathname === path);

describe('shootDay query', () => {
  it('joins crew from crew-service with a single batched request', async () => {
    const { data, errors } = await run(`{
      shootDay(id: "1") {
        unit production { title }
        assignments { role crewMember { name department availableOn(date: "2026-11-12") } }
      }
    }`);
    expect(errors).toBeUndefined();
    expect(data.shootDay.production.title).toBe('Northern Lights');
    expect(data.shootDay.assignments).toEqual([
      { role: 'DP', crewMember: { name: 'Maya Okafor', department: 'Camera', availableOn: true } },
      { role: 'Gaffer', crewMember: { name: 'Sam Whitfield', department: 'Grip & Electric', availableOn: false } },
    ]);
    expect(callsTo('/api/crew/batch')).toHaveLength(1);
  });

  it('returns null for unknown shoot days', async () => {
    const { data } = await run('{ shootDay(id: "999") { id } }');
    expect(data.shootDay).toBeNull();
  });
});

describe('assignCrew mutation', () => {
  const ASSIGN = `mutation($day: ID!, $crew: ID!) {
    assignCrew(shootDayId: $day, crewMemberId: $crew, role: "Gaffer") {
      __typename
      ... on AssignSuccess { assignment { id crewMember { name } } }
      ... on SchedulingConflict { crewMemberId conflicts { type shootDayId unit } }
    }
  }`;

  it('returns conflicts as data, not errors', async () => {
    const { data, errors } = await run(ASSIGN, { day: '2', crew: 'crew-001' });
    expect(errors).toBeUndefined();
    expect(data.assignCrew).toEqual({
      __typename: 'SchedulingConflict',
      crewMemberId: 'crew-001',
      conflicts: [{ type: 'DOUBLE_BOOKED', shootDayId: '1', unit: 'Main Unit' }],
    });
  });

  it('returns the assignment on success', async () => {
    const { data } = await run(ASSIGN, { day: '3', crew: 'crew-003' });
    expect(data.assignCrew).toEqual({ __typename: 'AssignSuccess', assignment: { id: '12', crewMember: { name: 'Sam Whitfield' } } });
  });

  it('rejects unknown crew members before calling scheduling-service', async () => {
    const { errors } = await run(ASSIGN, { day: '3', crew: 'crew-404' });
    expect(errors[0].extensions.code).toBe('NOT_FOUND');
    expect(callsTo('/api/shoot-days/3/assignments')).toHaveLength(0);
  });
});

describe('error mapping', () => {
  it('surfaces optimistic-lock failures as STALE_UPDATE', async () => {
    const { errors } = await run(`mutation { rescheduleShootDay(id: "1", input: { version: 0, locationName: "Stage 9" }) { __typename } }`);
    expect(errors[0].extensions.code).toBe('STALE_UPDATE');
  });

  it('reports an unreachable service clearly', async () => {
    fetchImpl.mockRejectedValueOnce(new TypeError('fetch failed'));
    const { errors } = await run('{ shootDay(id: "1") { id } }');
    expect(errors[0].extensions).toMatchObject({ code: 'SERVICE_UNAVAILABLE', service: 'scheduling-service' });
  });
});

describe('publishCallSheet', () => {
  it('is a dry run without a bucket', async () => {
    const { data } = await run('mutation { publishCallSheet(shootDayId: "1") { status objectKey } }');
    expect(data.publishCallSheet).toEqual({ status: 'DRY_RUN', objectKey: 'callsheets/1/v0.json' });
  });

  it('uploads the enriched call sheet to S3 when configured', async () => {
    const s3 = { send: vi.fn().mockResolvedValue({}) };
    context = contextFactory({ schedulingUrl: SCHED, crewUrl: CREW, fetchImpl, publisher: createPublisher({ bucket: 'b', s3 }) });
    const { data } = await run('mutation { publishCallSheet(shootDayId: "1") { status } }');
    expect(data.publishCallSheet.status).toBe('PUBLISHED');
    const body = JSON.parse(s3.send.mock.calls[0][0].input.Body);
    expect(body.assignments[1].crewMember.name).toBe('Sam Whitfield');
  });
});
