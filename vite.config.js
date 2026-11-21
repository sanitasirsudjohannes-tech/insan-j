import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Library pihak ketiga dipisah agar cache per vendor stabil: perubahan kode
// aplikasi tidak memaksa browser mengunduh ulang seluruh library.
const vendorChunks = [
  ['react-vendor', /node_modules[\\/](?:react|react-dom|react-router|react-router-dom|scheduler)[\\/]/],
  ['supabase-vendor', /node_modules[\\/]@supabase[\\/]/],
  ['sweetalert-vendor', /node_modules[\\/](?:sweetalert2|sweetalert2-react-content)[\\/]/],
  ['charts-vendor', /node_modules[\\/](?:recharts|d3-[^\\/]+|victory-vendor)[\\/]/],
  ['map-vendor', /node_modules[\\/](?:leaflet|react-leaflet)[\\/]/],
];

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    manifest: 'offline-assets.json',
    rollupOptions: {
      output: {
        manualChunks(id) {
          const group = vendorChunks.find(([, pattern]) => pattern.test(id));
          return group?.[0];
        },
      },
    },
  },
  // base: '/' is default - cocok untuk Vercel
})
