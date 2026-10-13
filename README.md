# iptu — assistente de revisão de IPTU

Ajuda o proprietário a pedir revisão do IPTU/valor venal: lê os documentos que ele
já tem (laudo de vistoria, carnê), monta o requerimento da prefeitura e pede só o
que falta.

**Stack igual à dos apps da VPS** (exbogrim): backend Express 5 + TypeScript via
`tsx` (pm2), frontend React 19 + Vite com build local servido estático pelo nginx.
Nada de processo Python na VPS — RAM de 1,9 GB.

## Estrutura

| Caminho | O que é |
|---|---|
| `app/backend/src/tipos.ts` | modelo de dados: `PerfilMunicipio` (fixo por prefeitura) e `Caso` (por imóvel), com `origens` de cada campo |
| `app/backend/src/extrair/` | extratores por tipo de documento (`laudo-msys.ts`, `carne-mogi-mirim.ts`) e `pdf.ts` (texto + posição via `unpdf`) |
| `app/backend/src/cruzamento.ts` | junta as extrações num `Caso`: carnê vence nos dados cadastrais, divergências viram alerta |
| `app/backend/src/extrai.ts` | CLI: reconhece cada PDF, extrai, cruza, grava e compara com um caso de referência |
| `app/backend/src/calc.ts` | VVC, faixa de alíquota, IPTU e lixo com arredondamento por parcela; simulação e cenários |
| `app/backend/src/simula.ts` | CLI da simulação (quadro do requerimento) |
| `app/backend/src/classificar.ts` | sugestão de padrão/conservação via Claude API (`claude-opus-5-5`, saída estruturada com zod) + confirmações para o proprietário, com o impacto no IPTU calculado por `calc.ts` |
| `app/backend/src/classifica.ts` | CLI da classificação (precisa de `ANTHROPIC_API_KEY`) |
| `app/backend/src/confere-exemplo.ts` | confere um caso: campos vazios, campos sem origem, se o lançamento fecha |
| `app/backend/src/extrair/generico-ia.ts` | leitura por IA de PDFs sem extrator próprio |
| `app/backend/src/server.ts`, `routes/iptu.ts` | API (`/api/municipios`, `/documentos`, `/caso`, `/simular`, `/classificacoes`) na porta 3010 |
| `app/frontend/` | tela React: documentos → dados → classificação/confirmações → simulação |
| `municipios/<id>.json` | perfil do município (leis, valores/m², FC, alíquotas, parcelas, lixo) |
| `casos/*.json` | casos reais — **fora do git** (CPF, endereço) |
| `docs/analise_exemplo_mogi_mirim.md` | de onde veio cada dado do requerimento-exemplo |

PDFs, .docx e `casos/` ficam fora do git de propósito (dados pessoais).

## Rodar a tela

```bash
cd app/backend && npm run dev     # API em :3010 (lê ANTHROPIC_API_KEY do ambiente)
cd app/frontend && npx vite        # http://localhost:5173 (proxy /api → 3010)
```

Sem login por enquanto: só para uso local. Relatório da etapa 1 em `docs/relatorio_etapa1.md`.

## CLIs

```bash
cd app/backend
npm run extrai -- mogi_mirim ../../laudo.pdf ../../iptu.pdf --compara ../../casos/exemplo_porto.json
npm run simula                  # quadro comparativo + memória + todos os cenários
npm run simula -- --conservacao Mau --area 120
npm run classifica -- casos/x.json --saida /tmp/x.json   # ~US$ 0,20 e ~1,5 min por caso
npm run confere                 # usa casos/exemplo_porto.json
npm run confere -- casos/x.json
npm run typecheck
```
