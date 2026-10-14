export class GraphQLRequestError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message)
  }
}

/** Tiny GraphQL client: one POST, typed result, errors surfaced with their extension code. */
export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  let res: Response
  try {
    res = await fetch('/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    })
  } catch {
    throw new GraphQLRequestError('Cannot reach the CallSheet API. Check your connection and try again.', 'NETWORK')
  }
  const body = await res.json().catch(() => ({}))
  if (body.errors?.length) {
    const [first] = body.errors
    throw new GraphQLRequestError(first.message, first.extensions?.code)
  }
  if (!res.ok || !body.data) throw new GraphQLRequestError(`Request failed (${res.status})`)
  return body.data as T
}
