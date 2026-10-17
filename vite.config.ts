import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // The Admin Console is deployed under https://…/dormpass on the home
  // server, whose root is another app (Luvify) — root-relative /assets/*
  // would collide with it. Production builds must therefore reference
  // /dormpass/assets/*; local dev keeps the plain root.
  base: mode === 'production' ? '/dormpass/' : '/',
  server: {
    // The backend's default CORS allow-list includes localhost/127.0.0.1:5173.
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
}))
