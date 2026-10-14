export interface Production {
  id: string
  title: string
  startDate: string
  endDate: string
  shootDays?: ShootDay[]
}

export interface CrewMember {
  id: string
  name: string
  department: string
  roles: string[]
  email: string
  phone?: string | null
  pronouns?: string | null
  unavailable: { from: string; to: string; reason?: string | null }[]
  availableOn?: boolean
  schedule?: ScheduleEntry[]
}

export interface Assignment {
  id: string
  role: string
  crewMemberId: string
  crewMember: CrewMember | null
}

export interface ShootDay {
  id: string
  unit: string
  locationName: string
  callAt: string
  wrapAt: string
  notes?: string | null
  version: number
  production?: Pick<Production, 'id' | 'title'>
  assignments: Assignment[]
}

export interface ScheduleEntry {
  assignmentId: string
  role: string
  shootDayId: string
  productionTitle: string
  unit: string
  locationName: string
  callAt: string
  wrapAt: string
}

export type ConflictType = 'DOUBLE_BOOKED' | 'TURNAROUND_VIOLATION'

export interface Conflict {
  type: ConflictType
  message: string
  shootDayId: string
  productionTitle: string
  unit: string
  callAt: string
  wrapAt: string
}

export interface SchedulingConflict {
  __typename: 'SchedulingConflict'
  crewMemberId: string
  message: string
  conflicts: Conflict[]
}
