const CONFLICT_FIELDS = `crewMemberId message conflicts { type message shootDayId productionTitle unit callAt wrapAt }`
const SHOOT_DAY_FIELDS = `
  id unit locationName callAt wrapAt notes version
  production { id title }
  assignments { id role crewMemberId crewMember { id name department pronouns email phone } }`

export const PRODUCTIONS = `query { productions { id title startDate endDate } }`

export const PRODUCTION = `query($id: ID!) {
  production(id: $id) {
    id title startDate endDate
    shootDays { id unit locationName callAt wrapAt version assignments { id } }
  }
}`

export const CREATE_PRODUCTION = `mutation($input: CreateProductionInput!) {
  createProduction(input: $input) { id }
}`

export const CREATE_SHOOT_DAY = `mutation($productionId: ID!, $input: CreateShootDayInput!) {
  createShootDay(productionId: $productionId, input: $input) { id }
}`

export const SHOOT_DAY = `query($id: ID!) { shootDay(id: $id) { ${SHOOT_DAY_FIELDS} } }`

export const AVAILABLE_CREW = `query($date: String!, $department: String, $search: String) {
  crew(availableOn: $date, department: $department, search: $search, limit: 100) {
    total items { id name department roles }
  }
}`

export const CHECK_CONFLICTS = `query($crewMemberId: ID!, $shootDayId: ID!) {
  checkConflicts(crewMemberId: $crewMemberId, shootDayId: $shootDayId) { type message }
}`

export const ASSIGN_CREW = `mutation($shootDayId: ID!, $crewMemberId: ID!, $role: String!) {
  assignCrew(shootDayId: $shootDayId, crewMemberId: $crewMemberId, role: $role) {
    __typename
    ... on AssignSuccess { assignment { id } }
    ... on SchedulingConflict { ${CONFLICT_FIELDS} }
  }
}`

export const UNASSIGN_CREW = `mutation($assignmentId: ID!) { unassignCrew(assignmentId: $assignmentId) }`

export const RESCHEDULE = `mutation($id: ID!, $input: RescheduleShootDayInput!) {
  rescheduleShootDay(id: $id, input: $input) {
    __typename
    ... on RescheduleSuccess { shootDay { ${SHOOT_DAY_FIELDS} } }
    ... on SchedulingConflict { ${CONFLICT_FIELDS} }
  }
}`

export const PUBLISH = `mutation($id: ID!) { publishCallSheet(shootDayId: $id) { status objectKey } }`

export const CREW_DIRECTORY = `query($department: String, $search: String) {
  departments
  crew(department: $department, search: $search, limit: 200) {
    total items { id name department roles pronouns email unavailable { from to reason } }
  }
}`

export const CREW_MEMBER = `query($id: ID!) {
  crewMember(id: $id) {
    id name department roles pronouns email phone
    unavailable { from to reason }
    schedule { assignmentId role shootDayId productionTitle unit locationName callAt wrapAt }
  }
}`
