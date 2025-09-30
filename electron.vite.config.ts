import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react-swc'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import copy from 'rollup-plugin-copy'
import tailwindcss from '@tailwindcss/vite'
import svgr from 'vite-plugin-svgr'

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin(),
      copy({
        targets: [
          {
            src: 'src/server',
            dest: 'out'
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
    plugins: [
      react(), 
      TanStackRouterVite({
        routesDirectory: './src/renderer/src/routes',
        generatedRouteTree: './src/renderer/src/routeTree.gen.ts',
      }), 
      tailwindcss(),
      svgr({ 
        svgrOptions: {
          // Additional SVGR options can be added here if needed
        }
      })
    ],
    server: {
      host: '0.0.0.0',
      port: 5173,
      // Removed proxy configuration since we're using IPC instead of HTTP
      hmr: {
        protocol: 'ws',
        host: 'localhost',
        port: 5173,
      },
    }
  }
})
