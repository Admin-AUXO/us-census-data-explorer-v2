import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import legacy from '@vitejs/plugin-legacy'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/us-census-data-explorer/' : '/',
  plugins: [
    vue(),
    legacy({
      targets: ['defaults', 'not IE 11'],
      modernPolyfills: true
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    cssTarget: ['chrome64', 'safari13'],
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'pinia'],
          charts: ['chart.js', 'vue-chartjs', 'chartjs-plugin-annotation']
        }
      }
    }
  }
}))
