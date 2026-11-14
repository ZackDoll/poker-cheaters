import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// There is no separate API server to proxy to: the /api functions run under `vercel dev`.
export default defineConfig({
  plugins: [react()],
})
