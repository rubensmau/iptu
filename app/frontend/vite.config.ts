import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Data e hora do build (horário de Brasília): vai no título da página e no cabeçalho,
// para saber de relance qual versão está no ar durante os testes.
const VERSAO = new Date().toLocaleString('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).replace(',', '')

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base = env.BASE_PATH || '/'
  return {
    base,
    define: { __VERSAO__: JSON.stringify(VERSAO) },
    plugins: [
      react(),
      { name: 'versao-no-titulo', transformIndexHtml: (html) => html.replace('%VERSAO%', VERSAO) },
    ],
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
