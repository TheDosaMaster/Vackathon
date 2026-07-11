import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': 'http://127.0.0.1:5001',
      '/classroom': 'http://127.0.0.1:5001',
      '/calendar': 'http://127.0.0.1:5001',
    },
  },
})
