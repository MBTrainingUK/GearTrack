import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/GearTrack/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('firebase')) return 'firebase';
          if (id.includes('@fullcalendar')) return 'fullcalendar';
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
        },
      },
    },
  },
})
