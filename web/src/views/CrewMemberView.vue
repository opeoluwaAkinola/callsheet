<script setup lang="ts">
import { ref, watch } from 'vue'
import { gql } from '../api/client'
import { CREW_MEMBER } from '../api/queries'
import type { CrewMember } from '../api/types'
import AsyncState from '../components/AsyncState.vue'
import { formatDate, formatRange } from '../format'

const props = defineProps<{ id: string }>()
const member = ref<CrewMember | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

watch(() => props.id, async (id) => {
  loading.value = true
  try {
    member.value = (await gql<{ crewMember: CrewMember | null }>(CREW_MEMBER, { id })).crewMember
    error.value = member.value ? null : 'This crew member does not exist.'
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}, { immediate: true })
</script>

<template>
  <AsyncState :loading="loading" :error="error">
    <template v-if="member">
      <p class="crumb"><RouterLink to="/crew">Crew</RouterLink></p>
      <h1 tabindex="-1">{{ member.name }}</h1>
      <p class="subtitle">
        {{ member.department }} · {{ member.roles.join(', ') }}<span v-if="member.pronouns"> · {{ member.pronouns }}</span>
      </p>
      <p><a :href="`mailto:${member.email}`">{{ member.email }}</a><span v-if="member.phone"> · {{ member.phone }}</span></p>

      <h2>Schedule</h2>
      <ul v-if="member.schedule?.length" class="list">
        <li v-for="s in member.schedule" :key="s.assignmentId">
          <RouterLink class="card card-link" :to="{ name: 'shoot-day', params: { id: s.shootDayId } }">
            <div class="row spread"><h3>{{ formatDate(s.callAt) }}</h3><span class="badge">{{ s.role }}</span></div>
            <div>{{ s.productionTitle }} · {{ s.unit }}</div>
            <div class="muted">{{ formatRange(s.callAt, s.wrapAt) }} · {{ s.locationName }}</div>
          </RouterLink>
        </li>
      </ul>
      <p v-else class="muted">Not booked on any shoot days.</p>

      <h2>Unavailable</h2>
      <ul v-if="member.unavailable.length">
        <li v-for="u in member.unavailable" :key="u.from">{{ formatDate(u.from) }} – {{ formatDate(u.to) }}<span v-if="u.reason" class="muted"> ({{ u.reason }})</span></li>
      </ul>
      <p v-else class="muted">No blocked dates.</p>
    </template>
  </AsyncState>
</template>
