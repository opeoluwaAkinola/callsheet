#!/usr/bin/env bash
# End-to-end check against a running stack: web (nginx) -> gateway (GraphQL) -> Java + Node services -> Postgres + Mongo.
set -euo pipefail
BASE="${1:-http://localhost:8080}"

gql() {
  curl -fsS "$BASE/graphql" -H 'content-type: application/json' -d "{\"query\":$(printf '%s' "$1" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')}"
}

expect() {
  if ! grep -q "$2" <<<"$3"; then
    echo "FAIL: $1"; echo "  expected to find: $2"; echo "  got: $3"; exit 1
  fi
  echo "ok - $1"
}

for _ in $(seq 1 30); do
  curl -fsS "$BASE/" >/dev/null 2>&1 && break
  sleep 2
done

expect "web serves the app" '<div id="app">' "$(curl -fsS "$BASE/shoot-days/1")"
expect "shoot day joins crew from crew-service" '"name":"Maya Okafor"' \
  "$(gql '{ shootDay(id: "1") { assignments { crewMember { name } } } }')"
expect "double booking is detected" '"type":"DOUBLE_BOOKED"' \
  "$(gql 'mutation { assignCrew(shootDayId: "2", crewMemberId: "crew-001", role: "DP") { __typename ... on SchedulingConflict { conflicts { type } } } }')"
expect "conflicts are detected across productions" 'Studio Sessions: Live' \
  "$(gql '{ checkConflicts(crewMemberId: "crew-005", shootDayId: "3") { message } }')"
expect "available crew filter excludes blocked dates" '"total":7' \
  "$(gql '{ crew(availableOn: "2026-11-12") { total } }')"
expect "call sheet publish works (dry run locally)" '"objectKey":"callsheets/1/v' \
  "$(gql 'mutation { publishCallSheet(shootDayId: "1") { status objectKey } }')"
echo "All smoke tests passed."
