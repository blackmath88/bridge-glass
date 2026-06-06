import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base '/' for Cloudflare Pages
export default defineConfig({
  plugins: [react()],
  base: '/',
})
