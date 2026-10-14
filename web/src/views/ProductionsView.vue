<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { gql } from '../api/client'
import { CREATE_PRODUCTION, PRODUCTIONS } from '../api/queries'
import type { Production } from '../api/types'
import AsyncState from '../components/AsyncState.vue'
import { formatDate } from '../format'

const router = useRouter()
const productions = ref<Production[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const showForm = ref(false)
const form = ref({ title: '', startDate: '', endDate: '' })
const formError = ref<string | null>(null)

onMounted(async () => {
  try {
    productions.value = (await gql<{ productions: Production[] }>(PRODUCTIONS)).productions
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
})

async function create() {
  formError.value = null
  try {
    const { createProduction } = await gql<{ createProduction: { id: string } }>(CREATE_PRODUCTION, { input: form.value })
    router.push({ name: 'production', params: { id: createProduction.id } })
  } catch (e) {
    formError.value = (e as Error).message
  }
}
</script>

<template>
  <div class="row spread">
    <div>
      <h1 tabindex="-1">Productions</h1>
      <p class="subtitle">Everything currently in prep or shooting.</p>
    </div>
    <button class="secondary" type="button" :aria-expanded="showForm" aria-controls="new-production" @click="showForm = !showForm">
      New production
    </button>
  </div>

  <form v-if="showForm" id="new-production" class="card form-grid" style="margin-bottom: 24px" @submit.prevent="create">
    <label>Title <input v-model="form.title" required maxlength="200" /></label>
    <label>Start date <input v-model="form.startDate" type="date" required /></label>
    <label>End date <input v-model="form.endDate" type="date" required :min="form.startDate" /></label>
    <button type="submit">Create</button>
    <p v-if="formError" class="alert error" role="alert" style="grid-column: 1 / -1">{{ formError }}</p>
  </form>

  <AsyncState :loading="loading" :error="error">
    <ul class="grid list" v-if="productions.length">
      <li v-for="p in productions" :key="p.id">
        <RouterLink class="card card-link" :to="{ name: 'production', params: { id: p.id } }">
          <h3>{{ p.title }}</h3>
          <span class="muted">{{ formatDate(p.startDate) }} – {{ formatDate(p.endDate) }}</span>
        </RouterLink>
      </li>
    </ul>
    <p v-else class="muted">No productions yet.</p>
  </AsyncState>
</template>
