import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()], base: './',
  build: {
    chunkSizeWarningLimit: 2000, cssCodeSplit: true,
    rollupOptions: { output: { manualChunks(id) {
      if (id.includes('node_modules')) {
        if (/three|@react-three|three-stdlib|camera-controls|troika/.test(id)) return 'three'
        if (/react|scheduler|zustand/.test(id)) return 'react'
      }
    } } },
  },
})
