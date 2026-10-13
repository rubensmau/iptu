// Lê os documentos do proprietário, monta o Caso e (opcional) compara com um caso de referência.
// Uso: npm run extrai -- <municipio> <arquivo.pdf>... [--ia] [--saida casos/x.json] [--compara casos/ref.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { extrairDocumento } from './extrair/index.js';
import { montarCaso } from './cruzamento.js';
import type { Caso, Extracao } from './tipos.js';

function opcao(args: string[], nome: string): string | undefined {
  const i = args.indexOf(nome);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
}

/** Folhas comparáveis de um caso (sem classificação, anexos, origens e alertas). */
function folhas(obj: unknown, prefixo = ''): Map<string, string> {
  const m = new Map<string, string>();
  if (obj === null || typeof obj !== 'object') { m.set(prefixo, JSON.stringify(obj ?? null)); return m; }
  for (const [k, v] of Object.entries(obj)) {
    for (const [kk, vv] of folhas(v, prefixo ? `${prefixo}.${k}` : k)) m.set(kk, vv);
  }
  return m;
}

function compara(obtido: Caso, referencia: Caso) {
  const pick = (c: Caso) => ({ requerente: c.requerente, imovel: c.imovel, lancamento: c.lancamento, laudo: c.laudo });
  const a = folhas(pick(obtido)), b = folhas(pick(referencia));
  let iguais = 0;
  const difs: string[] = [];
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    if (a.get(k) === b.get(k)) iguais++;
    else difs.push(`  ${k}\n      extraído:   ${a.get(k) ?? '(ausente)'}\n      referência: ${b.get(k) ?? '(ausente)'}`);
  }
  console.log(`\nComparação com a referência: ${iguais} iguais, ${difs.length} diferentes`);
  difs.forEach((d) => console.log(d));
}

const args = process.argv.slice(2);
const saida = opcao(args, '--saida');
const referencia = opcao(args, '--compara');
const usarIA = args.includes('--ia') && args.splice(args.indexOf('--ia'), 1).length > 0;
const [municipio, ...arquivos] = args;
if (!municipio || !arquivos.length) {
  console.error('uso: npm run extrai -- <municipio> <arquivo.pdf>... [--saida x.json] [--compara ref.json]');
  process.exit(1);
}

const extracoes: Extracao[] = [];
for (const arq of arquivos) {
  const r = await extrairDocumento(new Uint8Array(readFileSync(arq)), arq, usarIA);
  const ext = r.extracao;
  if (!ext) { console.log(`${arq}: ${r.erro}`); continue; }
  console.log(`${arq}: ${ext.documento} (${r.metodo}), ${Object.keys(ext.origens).length} campos`);
  extracoes.push(ext);
}
const caso = montarCaso(municipio, extracoes);
console.log(`\nAlertas (${caso.alertas.length}):`);
caso.alertas.forEach((a) => console.log(`  - ${a}`));
if (saida) { writeFileSync(saida, JSON.stringify(caso, null, 2) + '\n', 'utf-8'); console.log(`\nGravado em ${saida}`); }
if (referencia) compara(caso, JSON.parse(readFileSync(referencia, 'utf-8')));
