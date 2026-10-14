# 1. A GraphQL gateway over REST microservices

**Status:** Accepted

## Context
A shoot day page needs data owned by two services: schedules (scheduling-service, PostgreSQL) and crew profiles (crew-service, MongoDB). Calling both from the browser means several round trips, duplicated join logic in the client, and N+1 requests when resolving each assignment's crew member.

## Decision
Keep the services as plain REST APIs that are easy to test and integrate, and put a thin GraphQL gateway (Apollo Server) in front of them as a backend-for-frontend.

- The gateway owns no data. It composes and reshapes.
- Crew lookups go through a per-request **DataLoader** that hits `GET /api/crew/batch`, so a day with 40 crew is 1 request, not 40.
- Expected business outcomes (scheduling conflicts) are modelled as **union result types** (`AssignSuccess | SchedulingConflict`), not GraphQL errors, so clients handle them with type safety.

## Consequences
- The UI makes one request per page.
- Other systems (payroll, travel) can integrate with the REST APIs directly, which are documented with OpenAPI.
- The gateway is one more deployable. It is stateless and scales horizontally (see the HPA).
- If more teams contribute subgraphs, migrating to Apollo Federation is a natural next step.
