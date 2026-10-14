# 3. Conflict detection as pure domain logic

**Status:** Accepted

## Context
The core value of the product is preventing scheduling mistakes before they happen: double-booking a camera operator across Main and Second Unit, or giving someone less than the contractual minimum rest between wrap and the next call ("turnaround").

## Decision
`ConflictDetector` is a plain Java class with no Spring or JPA dependencies. It takes a candidate window and the crew member's existing windows, and returns a list of `Conflict`s. The service layer loads only the relevant windows (a query bounded by the call and wrap times, plus or minus the turnaround) and delegates to it.

The same rules run in three places:
1. **Dry run** (`POST /api/conflicts/check`), which the UI calls as soon as a crew member is picked
2. **Assign**, which is rejected with `409` and a structured list of conflicts
3. **Reschedule**, where moving a day re-checks every crew member already on it

## Consequences
- The rules have fast, exhaustive unit tests (overlap, back-to-back, both directions, the exact boundary).
- Minimum turnaround is configurable (`MIN_TURNAROUND_HOURS`) because it differs by union agreement.
