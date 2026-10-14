<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { gql } from '../api/client'
import { CREATE_SHOOT_DAY, PRODUCTION } from '../api/queries'
import type { Production } from '../api/types'
import AsyncState from '../components/AsyncState.vue'
import { formatDate, formatRange, fromInputValue, hours } from '../format'

const props = defineProps<{ id: string }>()
const production = ref<Production | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const showForm = ref(false)
const form = ref({ unit: 'Main Unit', locationName: '', callAt: '', wrapAt: '', notes: '' })
const formError = ref<string | null>(null)

async function load() {
  loading.value = true
  try {
    production.value = (await gql<{ production: Production | null }>(PRODUCTION, { id: props.id })).production
    error.value = production.value ? null : 'This production does not exist.'
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}
watch(() => props.id, load, { immediate: true })

const byDate = computed(() => {
  const groups = new Map<string, NonNullable<Production['shootDays']>>()
  for (const d of production.value?.shootDays ?? []) {
    const key = d.callAt.slice(0, 10)
    groups.set(key, [...(groups.get(key) ?? []), d])
  }
  return [...groups]
})

async function create() {
  formError.value = null
  try {
    await gql(CREATE_SHOOT_DAY, {
      productionId: props.id,
      input: { ...form.value, callAt: fromInputValue(form.value.callAt), wrapAt: fromInputValue(form.value.wrapAt), notes: form.value.notes || null },
    })
    showForm.value = false
    await load()
  } catch (e) {
    formError.value = (e as Error).message
  }
}
</script>

<template>
  <AsyncState :loading="loading && !production" :error="error">
    <template v-if="production">
      <p class="crumb"><RouterLink to="/">Productions</RouterLink></p>
      <div class="row spread">
        <div>
          <h1 tabindex="-1">{{ production.title }}</h1>
          <p class="subtitle">{{ formatDate(production.startDate) }} – {{ formatDate(production.endDate) }} · {{ production.shootDays?.length ?? 0 }} shoot days</p>
        </div>
        <button class="secondary" type="button" :aria-expanded="showForm" aria-controls="new-day" @click="showForm = !showForm">Add shoot day</button>
      </div>

      <form v-if="showForm" id="new-day" class="card form-grid" style="margin-bottom: 24px" @submit.prevent="create">
        <label>Unit
          <select v-model="form.unit"><option>Main Unit</option><option>Second Unit</option><option>Splinter Unit</option></select>
        </label>
        <label>Location <input v-model="form.locationName" required maxlength="200" /></label>
        <label>Call <input v-model="form.callAt" type="datetime-local" required :min="`${production.startDate}T00:00`" /></label>
        <label>Wrap <input v-model="form.wrapAt" type="datetime-local" required :min="form.callAt" /></label>
        <label style="grid-column: 1 / -1">Notes <input v-model="form.notes" maxlength="2000" /></label>
        <button type="submit">Create shoot day</button>
        <p v-if="formError" class="alert error" role="alert" style="grid-column: 1 / -1">{{ formError }}</p>
      </form>

      <section v-for="[date, days] in byDate" :key="date" :aria-labelledby="`d-${date}`">
        <h2 :id="`d-${date}`">{{ formatDate(date) }}</h2>
        <ul class="grid list">
          <li v-for="d in days" :key="d.id">
            <RouterLink class="card card-link" :to="{ name: 'shoot-day', params: { id: d.id } }">
              <div class="row spread"><h3>{{ d.unit }}</h3><span class="badge">{{ d.assignments.length }} crew</span></div>
              <div>{{ d.locationName }}</div>
              <div class="muted">{{ formatRange(d.callAt, d.wrapAt) }} · {{ hours(d.callAt, d.wrapAt) }}h</div>
            </RouterLink>
          </li>
        </ul>
      </section>
      <p v-if="!byDate.length" class="muted">No shoot days scheduled yet.</p>
    </template>
  </AsyncState>
</template>
