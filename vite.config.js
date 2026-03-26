import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf';
          if (id.includes('recharts'))                             return 'vendor-charts';
          if (id.includes('lucide-react') || id.includes('date-fns')) return 'vendor-ui';
          if (id.includes('node_modules'))                        return 'vendor-react';
        },
      },
    },
  },
})
