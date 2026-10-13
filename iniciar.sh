#!/bin/bash
# Sobe o app (API + tela) num processo só. Chamado por ~/iptu_teste.sh na VPS,
# que passa PORT=8090. Credenciais e chave da API em app/backend/.env:
#   IPTU_USUARIO, IPTU_SENHA, ANTHROPIC_API_KEY
# A tela precisa estar buildada em app/frontend/dist (buildar LOCAL: npx vite build).
set -euo pipefail
cd "$(dirname "$0")/app/backend"
export STATIC_DIR=../frontend/dist
# VPS de 1,9 GB compartilhada com o Dror: limita o heap para não puxar os outros apps para o swap
export NODE_OPTIONS=--max-old-space-size=256
exec node_modules/.bin/tsx src/server.ts
