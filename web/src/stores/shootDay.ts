import { defineStore } from 'pinia'
import { ref } from 'vue'
import { gql, GraphQLRequestError } from '../api/client'
import { ASSIGN_CREW, PUBLISH, RESCHEDULE, SHOOT_DAY, UNASSIGN_CREW } from '../api/queries'
import type { SchedulingConflict, ShootDay } from '../api/types'

type AssignResult = { __typename: 'AssignSuccess'; assignment: { id: string } } | SchedulingConflict
type RescheduleResult = { __typename: 'RescheduleSuccess'; shootDay: ShootDay } | SchedulingConflict

export interface RescheduleInput {
  locationName?: string
  callAt?: string
  wrapAt?: string
  notes?: string
}

export const useShootDayStore = defineStore('shootDay', () => {
  const day = ref<ShootDay | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  /** Set when the server rejects a change because someone else edited the day first. */
  const stale = ref(false)
  const conflict = ref<SchedulingConflict | null>(null)

  async function load(id: string) {
    loading.value = true
    error.value = null
    stale.value = false
    try {
      day.value = (await gql<{ shootDay: ShootDay | null }>(SHOOT_DAY, { id })).shootDay
      if (!day.value) error.value = 'This shoot day does not exist.'
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function assign(crewMemberId: string, role: string): Promise<boolean> {
    if (!day.value) return false
    conflict.value = null
    const { assignCrew } = await gql<{ assignCrew: AssignResult }>(ASSIGN_CREW, { shootDayId: day.value.id, crewMemberId, role })
    if (assignCrew.__typename === 'SchedulingConflict') {
      conflict.value = assignCrew
      return false
    }
    await load(day.value.id)
    return true
  }

  async function unassign(assignmentId: string) {
    if (!day.value) return
    await gql(UNASSIGN_CREW, { assignmentId })
    await load(day.value.id)
  }

  async function reschedule(input: RescheduleInput): Promise<boolean> {
    if (!day.value) return false
    conflict.value = null
    stale.value = false
    try {
      const { rescheduleShootDay: res } = await gql<{ rescheduleShootDay: RescheduleResult }>(RESCHEDULE, {
        id: day.value.id,
        input: { version: day.value.version, ...input },
      })
      if (res.__typename === 'SchedulingConflict') {
        conflict.value = res
        return false
      }
      day.value = res.shootDay
      return true
    } catch (e) {
      if (e instanceof GraphQLRequestError && e.code === 'STALE_UPDATE') {
        stale.value = true
        return false
      }
      throw e
    }
  }

  async function publish() {
    if (!day.value) return null
    return (await gql<{ publishCallSheet: { status: string; objectKey: string } }>(PUBLISH, { id: day.value.id })).publishCallSheet
  }

  return { day, loading, error, stale, conflict, load, assign, unassign, reschedule, publish }
})
