<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { Assignment } from '../api/types'
import AssignCrewPanel from '../components/AssignCrewPanel.vue'
import AsyncState from '../components/AsyncState.vue'
import ConflictAlert from '../components/ConflictAlert.vue'
import { formatDate, formatRange, fromInputValue, hours, toInputValue } from '../format'
import { useShootDayStore } from '../stores/shootDay'

const props = defineProps<{ id: string }>()
const store = useShootDayStore()
const { day, loading, error, stale, conflict } = storeToRefs(store)
const status = ref('')
const actionError = ref<string | null>(null)
const editing = ref(false)
const form = ref({ locationName: '', callAt: '', wrapAt: '', notes: '' })

watch(() => props.id, (id) => store.load(id), { immediate: true })

const byDepartment = computed(() => {
  const groups = new Map<string, Assignment[]>()
  for (const a of day.value?.assignments ?? []) {
    const dept = a.crewMember?.department ?? 'Unknown'
    groups.set(dept, [...(groups.get(dept) ?? []), a])
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b))
})

const conflictName = computed(() => conflict.value?.crewMemberId)

function startEdit() {
  if (!day.value) return
  form.value = {
    locationName: day.value.locationName,
    callAt: toInputValue(day.value.callAt),
    wrapAt: toInputValue(day.value.wrapAt),
    notes: day.value.notes ?? '',
  }
  editing.value = true
}

async function run(action: () => Promise<unknown>) {
  actionError.value = null
  try {
    await action()
  } catch (e) {
    actionError.value = (e as Error).message
  }
}

const saveEdit = () => run(async () => {
  const ok = await store.reschedule({
    locationName: form.value.locationName,
    callAt: fromInputValue(form.value.callAt),
    wrapAt: fromInputValue(form.value.wrapAt),
    notes: form.value.notes,
  })
  if (ok) {
    editing.value = false
    status.value = 'Shoot day updated.'
  }
})

const assign = (crewMemberId: string, role: string) => run(async () => {
  if (await store.assign(crewMemberId, role)) status.value = `Assigned ${role}.`
})

const remove = (a: Assignment) => run(async () => {
  if (!confirm(`Remove ${a.crewMember?.name ?? a.crewMemberId} from this day?`)) return
  await store.unassign(a.id)
  status.value = `Removed ${a.crewMember?.name ?? a.crewMemberId}.`
})

const publish = () => run(async () => {
  const res = await store.publish()
  if (!res) return
  status.value = res.status === 'PUBLISHED'
    ? 'Call sheet published. The PDF will be emailed to the crew shortly.'
    : `Dry run: no bucket configured locally, so nothing was uploaded (${res.objectKey}).`
})

const print = () => window.print()

async function reload() {
  editing.value = false
  await store.load(props.id)
}
</script>

<template>
  <AsyncState :loading="loading && !day" :error="error">
    <template v-if="day">
      <p class="crumb no-print">
        <RouterLink to="/">Productions</RouterLink> /
        <RouterLink v-if="day.production" :to="{ name: 'production', params: { id: day.production.id } }">{{ day.production.title }}</RouterLink>
      </p>
      <div class="row spread">
        <div>
          <h1 tabindex="-1">{{ day.production?.title }}: {{ day.unit }}</h1>
          <p class="subtitle">{{ formatDate(day.callAt) }} · version {{ day.version }}</p>
        </div>
        <div class="row no-print">
          <button class="secondary" type="button" @click="startEdit">Reschedule</button>
          <button class="secondary" type="button" @click="print">Print</button>
          <button type="button" @click="publish">Publish call sheet</button>
        </div>
      </div>

      <p class="visually-hidden" aria-live="polite">{{ status }}</p>
      <div v-if="status" class="alert ok no-print" aria-hidden="true">{{ status }}</div>
      <div v-if="actionError" class="alert error" role="alert">{{ actionError }}</div>
      <div v-if="stale" class="alert warn" role="alert">
        Someone else changed this shoot day while you were editing it, so your changes weren't saved.
        <button class="link" type="button" @click="reload">Load the latest version</button>
      </div>
      <ConflictAlert v-if="conflict" :conflict="conflict" :crew-name="conflictName" @dismiss="conflict = null" />

      <form v-if="editing" class="card form-grid no-print" aria-label="Reschedule shoot day" @submit.prevent="saveEdit">
        <label>Location <input v-model="form.locationName" required maxlength="200" /></label>
        <label>Call <input v-model="form.callAt" type="datetime-local" required /></label>
        <label>Wrap <input v-model="form.wrapAt" type="datetime-local" required :min="form.callAt" /></label>
        <label style="grid-column: 1 / -1">Notes <input v-model="form.notes" maxlength="2000" /></label>
        <div class="row">
          <button type="submit">Save</button>
          <button class="secondary" type="button" @click="editing = false">Cancel</button>
        </div>
      </form>

      <dl class="grid card" style="margin: 16px 0">
        <div><dt class="muted">General call</dt><dd style="margin: 0; font-size: 22px; font-weight: 700">{{ formatRange(day.callAt, day.wrapAt) }}</dd></div>
        <div><dt class="muted">Shooting hours</dt><dd style="margin: 0; font-size: 22px; font-weight: 700">{{ hours(day.callAt, day.wrapAt) }}h</dd></div>
        <div><dt class="muted">Location</dt><dd style="margin: 0">{{ day.locationName }}</dd></div>
        <div v-if="day.notes"><dt class="muted">Notes</dt><dd style="margin: 0">{{ day.notes }}</dd></div>
      </dl>

      <h2>Crew ({{ day.assignments.length }})</h2>
      <table v-if="day.assignments.length">
        <caption class="visually-hidden">Crew assigned to this shoot day, grouped by department</caption>
        <thead>
          <tr><th scope="col">Role</th><th scope="col">Name</th><th scope="col" class="hide-sm">Contact</th><th scope="col" class="no-print"><span class="visually-hidden">Actions</span></th></tr>
        </thead>
        <tbody v-for="[dept, list] in byDepartment" :key="dept">
          <tr><th colspan="4" scope="colgroup">{{ dept }}</th></tr>
          <tr v-for="a in list" :key="a.id">
            <td>{{ a.role }}</td>
            <td>
              <RouterLink v-if="a.crewMember" :to="{ name: 'crew-member', params: { id: a.crewMemberId } }">{{ a.crewMember.name }}</RouterLink>
              <span v-else class="muted">{{ a.crewMemberId }} (profile missing)</span>
              <span v-if="a.crewMember?.pronouns" class="muted"> ({{ a.crewMember.pronouns }})</span>
            </td>
            <td class="hide-sm">{{ a.crewMember?.email }}</td>
            <td class="no-print"><button class="danger" type="button" :aria-label="`Remove ${a.crewMember?.name ?? a.crewMemberId}`" @click="remove(a)">Remove</button></td>
          </tr>
        </tbody>
      </table>
      <p v-else class="muted">Nobody is assigned yet.</p>

      <div style="margin-top: 24px">
        <AssignCrewPanel :day="day" @assign="assign" />
      </div>
    </template>
  </AsyncState>
</template>
