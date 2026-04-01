import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — changes rarely, browser caches it
          'vendor-react': ['react', 'react-dom', 'react-router'],

          // UI component libraries
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-tabs',
            '@radix-ui/react-select',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-popover',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-switch',
            '@radix-ui/react-slider',
          ],

          // Charts and data viz
          'vendor-charts': ['recharts'],

          // MUI icons (these alone are huge)
          'vendor-mui': ['@mui/material', '@mui/icons-material'],

          // Animation
          'vendor-motion': ['motion'],

          // Utilities
          'vendor-utils': ['date-fns', 'clsx', 'tailwind-merge', 'zustand', 'socket.io-client'],
        },
      },
    },
  },
})
