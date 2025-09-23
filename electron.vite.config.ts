import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react-swc'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import { builtinModules } from 'module'
import copy from 'rollup-plugin-copy'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin(),
      copy({
        targets: [
          {
            src: 'src/server/**/*',
            dest: 'out/server'
          },
          {
            src: 'resources/**/*',
            dest: 'out/resources'
          }
        ],
        hook: 'writeBundle'
      })
    ]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@tabler/icons-react': '@tabler/icons-react/dist/esm/icons/index.mjs',
      }
    },
    plugins: [react(), TanStackRouterVite({
      routesDirectory: './src/renderer/src/routes',
      generatedRouteTree: './src/renderer/src/routeTree.gen.ts',
    }), tailwindcss()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictSSL: false,
      proxy: {
        '/api': {
          target: process.env.VITE_API_URL || 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/ws': {
          target: process.env.VITE_WS_URL || 'ws://localhost:3000',
          ws: true,
          changeOrigin: true,
        }
      },
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        port: 5173,
      },
    }
  },
  build: {
    rollupOptions: {
      external: [...builtinModules, 'electron']
    },
    sourcemap: true,
    minify: 'esbuild'
  }
})
