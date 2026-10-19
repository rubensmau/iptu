# iptu — assistente de revisão de IPTU

Ajuda o proprietário a pedir revisão do IPTU/valor venal: lê os documentos que ele
já tem (laudo de vistoria, carnê), monta o requerimento da prefeitura e pede só o
que falta. O rascunho do requerimento (.docx) sai mesmo com lacunas, destacadas em amarelo.

A tela mostra no título e no cabeçalho a data e hora do build ("versão de …"), para conferir qual versão está no ar.

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
| `app/backend/src/calc.ts` | VVC (por bloco: corpo principal + áreas à parte, como Telheiro), faixa de alíquota, IPTU e lixo com arredondamento por parcela; simulação, cenários e hipóteses de blocos que explicam o lançamento |
| `app/backend/src/lacunas.ts` | o que falta para protocolar: bloqueia / preencher / conferir |
| `app/backend/src/requerimento.ts` | rascunho do requerimento (.docx, biblioteca `docx`), com lacunas em amarelo e lista na primeira página |
| `app/backend/src/gera-requerimento.ts` | CLI do requerimento |
| `app/backend/src/simula.ts` | CLI da simulação (quadro do requerimento) |
| `app/backend/src/classificar.ts` | sugestão de padrão/conservação via Claude API (`claude-opus-5-5`, saída estruturada com zod) + confirmações para o proprietário, com o impacto no IPTU calculado por `calc.ts` |
| `app/backend/src/classifica.ts` | CLI da classificação (precisa de `ANTHROPIC_API_KEY`) |
| `app/backend/src/confere-exemplo.ts` | confere um caso: campos vazios, campos sem origem, se o lançamento fecha |
| `app/backend/src/extrair/generico-ia.ts` | leitura por IA de PDFs sem extrator próprio |
| `app/backend/src/server.ts`, `routes/iptu.ts` | API (`/api/municipios`, `/documentos`, `/caso`, `/simular`, `/classificacoes`, `/lacunas`, `/requerimento`) na porta 3010 |
| `app/frontend/` | tela React: documentos → dados → classificação (por ambiente) e confirmações → simulação → requerimento |
| `municipios/<id>.json` | perfil do município: leis, tabela completa de valores/m² e descrição dos padrões, FC, alíquotas, parcelas, lixo, fundamentação e citações do requerimento. Mogi Mirim vem do texto oficial da LC 392/2025 |
| `casos/*.json` | casos reais — **fora do git** (CPF, endereço) |
| `docs/analise_exemplo_mogi_mirim.md` | de onde veio cada dado do requerimento-exemplo |
| `docs/respostas_socio_v1.md`, `docs/aprendizados_2026-10-15.md` | dúvidas respondidas pelo sócio, o que mudou no app e as lacunas abertas |
| `docs/aprendizados_2026-10-19.md` | legislação conferida, matrícula/escritura, valor de mercado e a lista de pendências |
| `docs/estudos/` | fundamentação dos valores de construção: método genérico, estudo de Mogi Mirim para a Prefeitura e notas internas |
| `docs/expansao_cidades.md` | quadro legal (Tema 1.113, EC 132) e cidades candidatas |

PDFs, .docx, `casos/` e `.env` ficam fora do git de propósito (dados pessoais e segredos).

Repositório: `git@github.com:rubensmau/iptu.git` (privado). Produção: VPS, `~/iptu`,
porta 8090 (`bash ~/iptu_teste.sh start|stop|status|log`), login HTTP Basic do próprio app.

## Backup

Entra nos dois backups pessoais sem etapa própria: `~/backup.sh` copia este diretório (inclusive
`casos/`, PDFs e `.docx`, que ficam fora do git) e o `~/iptu` da VPS; o
`~/pessoal/dror/backup_arquivos/backup_vps_apps.sh` leva o `~/iptu` da VPS com o `.env` e confere
que ele está no tarball. Detalhes em `~/BACKUP.md`, seção "App de revisão de IPTU".

## Rodar a tela

```bash
cd app/backend && npm run dev     # API em :3010 (lê ANTHROPIC_API_KEY do ambiente)
cd app/frontend && npx vite        # http://localhost:5173 (proxy /api → 3010)
```

Localmente não há login (sem `IPTU_USUARIO`/`IPTU_SENHA` no `.env`). Relatório da etapa 1 em `docs/relatorio_etapa1.md`.

## CLIs

```bash
cd app/backend
npm run extrai -- mogi_mirim ../../laudo.pdf ../../iptu.pdf --compara ../../casos/exemplo_porto.json
npm run simula                  # quadro comparativo + memória + todos os cenários
npm run simula -- --conservacao Mau --area 120
npm run classifica -- casos/x.json --saida /tmp/x.json   # ~US$ 0,20 e ~1,5 min por caso
npm run requerimento -- casos/x.json --saida /tmp/x.docx   # rascunho .docx + lista de lacunas
npm run confere                 # usa casos/exemplo_porto.json
npm run confere -- casos/x.json
npm run typecheck
```
