import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    // The preview is served through an HTTPS reverse proxy on a custom host, so
    // accept any host and route HMR back over the proxy's TLS port.
    allowedHosts: true,
    hmr: { clientPort: 443, protocol: 'wss' },
    // Proxy the API to the local backend in dev so the frontend can call
    // same-origin /api paths whether it runs behind the preview proxy or locally.
    proxy: {
      '/api': { target: 'http://localhost:8001', changeOrigin: true },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
