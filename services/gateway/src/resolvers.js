import DataLoader from 'dataloader';
import { GraphQLError } from 'graphql';
import { UpstreamConflict } from './clients.js';

const enc = encodeURIComponent;

/** Per-request loaders, so batching and caching never leak between users. */
export function createLoaders({ crew }) {
  return {
    crewById: new DataLoader(async (ids) => {
      const members = await crew.get(`/api/crew/batch?ids=${ids.map(enc).join(',')}`);
      const byId = new Map(members.map((m) => [m.id, m]));
      return ids.map((id) => byId.get(id) ?? null);
    }),
  };
}

const flattenConflict = ({ type, message, with: w }) => ({ type, message, ...w });

const toConflictResult = (err) => ({
  __typename: 'SchedulingConflict',
  crewMemberId: err.problem.crewMemberId,
  message: err.problem.detail,
  conflicts: err.problem.conflicts.map(flattenConflict),
});

/** Runs a mutation, mapping an upstream 409-with-conflicts to the SchedulingConflict union member. */
async function orConflict(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof UpstreamConflict) return toConflictResult(err);
    throw err;
  }
}

export const resolvers = {
  Query: {
    productions: (_, __, { scheduling }) => scheduling.get('/api/productions'),
    production: (_, { id }, { scheduling }) => scheduling.get(`/api/productions/${enc(id)}`),
    shootDay: (_, { id }, { scheduling }) => scheduling.get(`/api/shoot-days/${enc(id)}`),
    crew: (_, { department, search, availableOn, limit, offset }, { crew }) => {
      const qs = new URLSearchParams({ limit, offset });
      if (department) qs.set('department', department);
      if (search) qs.set('q', search);
      if (availableOn) qs.set('availableOn', availableOn);
      return crew.get(`/api/crew?${qs}`);
    },
    crewMember: (_, { id }, { loaders }) => loaders.crewById.load(id),
    departments: (_, __, { crew }) => crew.get('/api/departments'),
    checkConflicts: async (_, { crewMemberId, shootDayId }, { scheduling }) => {
      const res = await scheduling.post('/api/conflicts/check', { crewMemberId, shootDayId: Number(shootDayId) });
      return res.conflicts.map(flattenConflict);
    },
  },

  Mutation: {
    createProduction: (_, { input }, { scheduling }) => scheduling.post('/api/productions', input),
    createShootDay: (_, { productionId, input }, { scheduling }) =>
      scheduling.post(`/api/productions/${enc(productionId)}/shoot-days`, input),
    rescheduleShootDay: (_, { id, input }, { scheduling }) => orConflict(async () => ({
      __typename: 'RescheduleSuccess',
      shootDay: await scheduling.patch(`/api/shoot-days/${enc(id)}`, input),
    })),
    assignCrew: async (_, { shootDayId, crewMemberId, role }, { scheduling, loaders }) => {
      // Fail fast with a clear message rather than storing a dangling reference.
      if (!(await loaders.crewById.load(crewMemberId))) {
        throw new GraphQLError(`Crew member ${crewMemberId} not found`, { extensions: { code: 'NOT_FOUND' } });
      }
      return orConflict(async () => ({
        __typename: 'AssignSuccess',
        assignment: await scheduling.post(`/api/shoot-days/${enc(shootDayId)}/assignments`, { crewMemberId, role }),
      }));
    },
    unassignCrew: async (_, { assignmentId }, { scheduling }) => {
      await scheduling.delete(`/api/assignments/${enc(assignmentId)}`);
      return true;
    },
    publishCallSheet: async (_, { shootDayId }, { scheduling, loaders, publisher }) => {
      const day = await scheduling.get(`/api/shoot-days/${enc(shootDayId)}`);
      if (!day) {
        throw new GraphQLError(`Shoot day ${shootDayId} not found`, { extensions: { code: 'NOT_FOUND' } });
      }
      const members = await loaders.crewById.loadMany(day.assignments.map((a) => a.crewMemberId));
      const callSheet = {
        ...day,
        assignments: day.assignments.map((a, i) => ({ ...a, crewMember: members[i] instanceof Error ? null : members[i] })),
        publishedAt: new Date().toISOString(),
      };
      return publisher.publish(callSheet);
    },
  },

  Production: {
    shootDays: (p, _, { scheduling }) => scheduling.get(`/api/productions/${enc(p.id)}/shoot-days`),
  },

  ShootDay: {
    production: (d, _, { scheduling }) => scheduling.get(`/api/productions/${enc(d.productionId)}`),
  },

  Assignment: {
    crewMember: (a, _, { loaders }) => loaders.crewById.load(a.crewMemberId),
  },

  CrewMember: {
    unavailable: (m) => m.unavailable ?? [],
    availableOn: (m, { date }) => !(m.unavailable ?? []).some((u) => u.from <= date && date <= u.to),
    schedule: (m, _, { scheduling }) => scheduling.get(`/api/crew/${enc(m.id)}/schedule`),
  },
};
