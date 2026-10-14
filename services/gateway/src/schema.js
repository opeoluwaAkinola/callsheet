export const typeDefs = /* GraphQL */ `
  """
  A single graph over two services: productions, shoot days and assignments live in
  scheduling-service (Java/PostgreSQL); crew profiles live in crew-service (Node/MongoDB).
  """
  type Query {
    productions: [Production!]!
    production(id: ID!): Production
    shootDay(id: ID!): ShootDay
    crew(department: String, search: String, availableOn: String, limit: Int = 50, offset: Int = 0): CrewPage!
    crewMember(id: ID!): CrewMember
    departments: [String!]!
    "Dry run: would assigning this crew member to this shoot day cause a conflict?"
    checkConflicts(crewMemberId: ID!, shootDayId: ID!): [Conflict!]!
  }

  type Mutation {
    createProduction(input: CreateProductionInput!): Production!
    createShootDay(productionId: ID!, input: CreateShootDayInput!): ShootDay!
    "Fails with a STALE_UPDATE error if version does not match the latest version."
    rescheduleShootDay(id: ID!, input: RescheduleShootDayInput!): RescheduleResult!
    assignCrew(shootDayId: ID!, crewMemberId: ID!, role: String!): AssignResult!
    unassignCrew(assignmentId: ID!): Boolean!
    "Publishes the call sheet to S3, which triggers the PDF-rendering Lambda."
    publishCallSheet(shootDayId: ID!): PublishResult!
  }

  type Production {
    id: ID!
    title: String!
    startDate: String!
    endDate: String!
    shootDays: [ShootDay!]!
  }

  type ShootDay {
    id: ID!
    production: Production!
    unit: String!
    locationName: String!
    callAt: String!
    wrapAt: String!
    notes: String
    version: Int!
    assignments: [Assignment!]!
  }

  type Assignment {
    id: ID!
    role: String!
    crewMemberId: ID!
    "Resolved from crew-service in one batched request per query (DataLoader)."
    crewMember: CrewMember
  }

  type CrewMember {
    id: ID!
    name: String!
    department: String!
    roles: [String!]!
    email: String!
    phone: String
    pronouns: String
    unavailable: [Unavailability!]!
    availableOn(date: String!): Boolean!
    schedule: [ScheduleEntry!]!
  }

  type Unavailability {
    from: String!
    to: String!
    reason: String
  }

  type ScheduleEntry {
    assignmentId: ID!
    role: String!
    shootDayId: ID!
    productionTitle: String!
    unit: String!
    locationName: String!
    callAt: String!
    wrapAt: String!
  }

  type CrewPage {
    items: [CrewMember!]!
    total: Int!
  }

  enum ConflictType {
    DOUBLE_BOOKED
    TURNAROUND_VIOLATION
  }

  type Conflict {
    type: ConflictType!
    message: String!
    shootDayId: ID!
    productionTitle: String!
    unit: String!
    callAt: String!
    wrapAt: String!
  }

  "Scheduling conflicts are an expected outcome, so they are modelled as data rather than errors."
  type SchedulingConflict {
    crewMemberId: ID!
    message: String!
    conflicts: [Conflict!]!
  }

  type AssignSuccess {
    assignment: Assignment!
  }

  union AssignResult = AssignSuccess | SchedulingConflict

  type RescheduleSuccess {
    shootDay: ShootDay!
  }

  union RescheduleResult = RescheduleSuccess | SchedulingConflict

  enum PublishStatus {
    PUBLISHED
    DRY_RUN
  }

  type PublishResult {
    status: PublishStatus!
    objectKey: String!
  }

  input CreateProductionInput {
    title: String!
    startDate: String!
    endDate: String!
  }

  input CreateShootDayInput {
    unit: String!
    locationName: String!
    callAt: String!
    wrapAt: String!
    notes: String
  }

  input RescheduleShootDayInput {
    version: Int!
    locationName: String
    callAt: String
    wrapAt: String
    notes: String
  }
`;
