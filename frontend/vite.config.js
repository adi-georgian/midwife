import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // '/session' also covers '/sessions' and '/session/<id>/...' (prefix match)
      '/session': 'http://localhost:8000',
      '/me': 'http://localhost:8000',
    },
  },
})
