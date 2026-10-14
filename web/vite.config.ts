/// <reference types="vitest" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: { '/graphql': process.env.GATEWAY_URL ?? 'http://localhost:4000' },
  },
  test: {
    environment: 'jsdom',
  },
})
