# 2. PostgreSQL for schedules, MongoDB for crew

**Status:** Accepted

## Context
Scheduling data is relational and integrity-critical: a shoot day belongs to a production, an assignment belongs to a shoot day, and a crew member can only appear once per day. Crew profiles are document-shaped and vary by department (union details, certifications, rate cards).

## Decision
- **scheduling-service: PostgreSQL**, with foreign keys, CHECK constraints (`wrap_at > call_at`) and a unique constraint on `(shoot_day_id, crew_member_id)`. Migrations are managed by Flyway. Optimistic locking (`@Version`) protects concurrent edits.
- **crew-service: MongoDB**, with a unique index on email and a compound index on `(department, name)`.
- Services reference each other only by opaque id (`crew-001`). No cross-database joins.

## Consequences
- Each service can evolve its schema independently.
- Referential integrity across services is enforced at the gateway (an assignment to an unknown crew member is rejected before it reaches scheduling-service) rather than by the database.
