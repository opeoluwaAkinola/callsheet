<script setup lang="ts">
import type { SchedulingConflict } from '../api/types'
import { formatDate, formatRange } from '../format'

defineProps<{ conflict: SchedulingConflict; crewName?: string }>()
defineEmits<{ dismiss: [] }>()

const label = { DOUBLE_BOOKED: 'Double-booked', TURNAROUND_VIOLATION: 'Turnaround' } as const
</script>

<template>
  <div class="alert error" role="alert">
    <div class="row spread">
      <strong>{{ crewName ?? conflict.crewMemberId }} can't be scheduled here</strong>
      <button class="link" type="button" @click="$emit('dismiss')">Dismiss</button>
    </div>
    <ul>
      <li v-for="(c, i) in conflict.conflicts" :key="i">
        <span class="badge">{{ label[c.type] }}</span>
        {{ c.productionTitle }} · {{ c.unit }} · {{ formatDate(c.callAt) }}, {{ formatRange(c.callAt, c.wrapAt) }}
        <div class="muted">{{ c.message }}</div>
      </li>
    </ul>
  </div>
</template>
