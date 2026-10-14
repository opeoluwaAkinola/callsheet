import { GraphQLError } from 'graphql';

const CODES = { 400: 'BAD_USER_INPUT', 404: 'NOT_FOUND', 409: 'CONFLICT' };

/** Thrown for 409s so resolvers can turn expected conflicts into union results. */
export class UpstreamConflict extends Error {
  constructor(problem) {
    super(problem.detail);
    this.problem = problem;
  }
}

/** Minimal JSON-over-HTTP client that turns problem+json responses into GraphQL errors. */
export function restClient(baseUrl, { fetchImpl = fetch, service } = {}) {
  async function call(method, path, body) {
    let res;
    try {
      res = await fetchImpl(new URL(path, baseUrl), {
        method,
        headers: body ? { 'content-type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(5000),
      });
    } catch (err) {
      throw new GraphQLError(`${service} is unavailable`, { extensions: { code: 'SERVICE_UNAVAILABLE', service }, originalError: err });
    }
    if (res.status === 204) return null;
    const payload = await res.json().catch(() => ({}));
    if (res.ok) return payload;
    if (res.status === 404 && method === 'GET') return null;
    if (res.status === 409 && payload.conflicts) throw new UpstreamConflict(payload);
    const code = payload.title === 'Stale update' ? 'STALE_UPDATE' : (CODES[res.status] ?? 'UPSTREAM_ERROR');
    throw new GraphQLError(payload.detail ?? `${service} returned ${res.status}`, {
      extensions: { code, service, status: res.status, errors: payload.errors },
    });
  }
  return {
    get: (path) => call('GET', path),
    post: (path, body) => call('POST', path, body),
    patch: (path, body) => call('PATCH', path, body),
    delete: (path) => call('DELETE', path),
  };
}
