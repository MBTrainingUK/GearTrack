import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isGitHubPages = mode === 'production';
  const base = isGitHubPages ? '/GearTrack/' : '/';

  return {
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      base,
      manifest: {
        name: 'GearTrack',
        short_name: 'GearTrack',
        description: 'Quick gear checkout and check-in',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        scope: base,
        start_url: `${base}#/m/gear`,
        icons: [
          { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
          { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  base,
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
  }
})
