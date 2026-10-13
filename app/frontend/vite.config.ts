import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base = env.BASE_PATH || '/'
  return {
    base,
    plugins: [react()],
    server: {
      // em produção o nginx manda /iptu/api/ direto ao backend e isto não é usado
      proxy: {
        '^(/iptu)?/api/': {
          target: 'http://localhost:3010',
          rewrite: (p) => p.replace(/^\/iptu/, ''),
        },
      },
    },
  }
})
