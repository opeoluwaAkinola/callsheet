<script setup lang="ts">
import { ref, watch } from 'vue'
import { gql } from '../api/client'
import { CREW_DIRECTORY } from '../api/queries'
import type { CrewMember } from '../api/types'
import AsyncState from '../components/AsyncState.vue'
import { formatDate } from '../format'

const departments = ref<string[]>([])
const crew = ref<CrewMember[]>([])
const total = ref(0)
const department = ref('')
const search = ref('')
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  try {
    const res = await gql<{ departments: string[]; crew: { total: number; items: CrewMember[] } }>(CREW_DIRECTORY, {
      department: department.value || null,
      search: search.value || null,
    })
    departments.value = res.departments
    crew.value = res.crew.items
    total.value = res.crew.total
    error.value = null
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
watch([department, search], () => {
  clearTimeout(timer)
  timer = setTimeout(load, 250)
})
load()
</script>

<template>
  <h1 tabindex="-1">Crew</h1>
  <p class="subtitle">Directory of crew across all productions.</p>
  <div class="form-grid" role="search" style="margin-bottom: 16px">
    <label>Search <input v-model="search" type="search" placeholder="Name or role" /></label>
    <label>Department
      <select v-model="department">
        <option value="">All departments</option>
        <option v-for="d in departments" :key="d">{{ d }}</option>
      </select>
    </label>
  </div>
  <AsyncState :loading="loading" :error="error">
    <p class="muted" aria-live="polite">{{ total }} {{ total === 1 ? 'person' : 'people' }}</p>
    <table>
      <caption class="visually-hidden">Crew directory</caption>
      <thead><tr><th scope="col">Name</th><th scope="col">Department</th><th scope="col">Roles</th><th scope="col" class="hide-sm">Unavailable</th></tr></thead>
      <tbody>
        <tr v-for="m in crew" :key="m.id">
          <td><RouterLink :to="{ name: 'crew-member', params: { id: m.id } }">{{ m.name }}</RouterLink><span v-if="m.pronouns" class="muted"> ({{ m.pronouns }})</span></td>
          <td>{{ m.department }}</td>
          <td>{{ m.roles.join(', ') }}</td>
          <td class="hide-sm">
            <span v-for="u in m.unavailable" :key="u.from" class="badge warn">{{ formatDate(u.from) }} – {{ formatDate(u.to) }}</span>
            <span v-if="!m.unavailable.length" class="muted">None</span>
          </td>
        </tr>
      </tbody>
    </table>
  </AsyncState>
</template>
