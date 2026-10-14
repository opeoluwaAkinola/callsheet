<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="topbar">
    <RouterLink to="/" class="brand" aria-label="CallSheet home">
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="currentColor"/><path d="M8 11h16v12H8z" fill="none" stroke="var(--bg)" stroke-width="2"/><path d="M8 11l3-4h4l-3 4m4 0l3-4h4l-3 4" fill="none" stroke="var(--bg)" stroke-width="2"/></svg>
      CallSheet
    </RouterLink>
    <nav aria-label="Primary">
      <RouterLink to="/">Productions</RouterLink>
      <RouterLink to="/crew">Crew</RouterLink>
    </nav>
  </header>
  <main id="main">
    <RouterView />
  </main>
</template>
