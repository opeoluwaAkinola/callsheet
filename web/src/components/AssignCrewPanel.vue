<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { gql } from '../api/client'
import { AVAILABLE_CREW, CHECK_CONFLICTS } from '../api/queries'
import type { Conflict, CrewMember, ShootDay } from '../api/types'

const props = defineProps<{ day: ShootDay }>()
const emit = defineEmits<{ assign: [crewMemberId: string, role: string] }>()

const crew = ref<CrewMember[]>([])
const search = ref('')
const crewMemberId = ref('')
const role = ref('')
const preview = ref<Pick<Conflict, 'type' | 'message'>[] | null>(null)
const checking = ref(false)

const assignedIds = computed(() => new Set(props.day.assignments.map((a) => a.crewMemberId)))
const options = computed(() => crew.value.filter((m) => !assignedIds.value.has(m.id)))
const selected = computed(() => crew.value.find((m) => m.id === crewMemberId.value))

async function loadCrew() {
  const res = await gql<{ crew: { items: CrewMember[] } }>(AVAILABLE_CREW, {
    date: props.day.callAt.slice(0, 10),
    search: search.value || null,
  })
  crew.value = res.crew.items
}

// Live dry run: tell the coordinator about a conflict before they press Assign.
watch(crewMemberId, async (id) => {
  preview.value = null
  if (!id) return
  role.value = selected.value?.roles[0] ?? ''
  checking.value = true
  try {
    preview.value = (await gql<{ checkConflicts: Conflict[] }>(CHECK_CONFLICTS, { crewMemberId: id, shootDayId: props.day.id })).checkConflicts
  } finally {
    checking.value = false
  }
})

let timer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(timer)
  timer = setTimeout(loadCrew, 250)
})
watch(() => props.day.id, loadCrew, { immediate: true })

function submit() {
  if (!crewMemberId.value || !role.value) return
  emit('assign', crewMemberId.value, role.value)
  crewMemberId.value = ''
  role.value = ''
}
</script>

<template>
  <form class="card stack no-print" aria-labelledby="assign-heading" @submit.prevent="submit">
    <h2 id="assign-heading" style="margin: 0">Add crew</h2>
    <p class="muted" style="margin: 0">Only crew available on this date are listed. Conflicts are checked as you pick.</p>
    <div class="form-grid">
      <label>Search
        <input v-model="search" type="search" placeholder="Name or role" />
      </label>
      <label>Crew member
        <select v-model="crewMemberId" required>
          <option value="" disabled>Choose… ({{ options.length }} available)</option>
          <option v-for="m in options" :key="m.id" :value="m.id">{{ m.name }} ({{ m.department }})</option>
        </select>
      </label>
      <label>Role
        <input v-model="role" list="role-suggestions" required maxlength="100" />
        <datalist id="role-suggestions">
          <option v-for="r in selected?.roles ?? []" :key="r" :value="r" />
        </datalist>
      </label>
      <button type="submit" :disabled="!crewMemberId || !role">Assign</button>
    </div>
    <div aria-live="polite">
      <p v-if="checking" class="muted" style="margin: 0">Checking schedule…</p>
      <div v-else-if="preview && preview.length" class="alert warn" style="margin: 0">
        <strong>Heads up:</strong> assigning {{ selected?.name }} will be rejected.
        <ul><li v-for="(c, i) in preview" :key="i">{{ c.message }}</li></ul>
      </div>
      <p v-else-if="preview" class="badge ok">No conflicts</p>
    </div>
  </form>
</template>
