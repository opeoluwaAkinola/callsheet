<script setup lang="ts">
defineProps<{ loading: boolean; error: string | null }>()
</script>

<template>
  <p v-if="loading" class="muted" role="status">Loading…</p>
  <div v-else-if="error" class="alert error" role="alert">{{ error }}</div>
  <slot v-else />
</template>
