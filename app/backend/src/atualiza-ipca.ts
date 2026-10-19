// Baixa do IBGE (SIDRA, tabela 1737, variável 2266) o número-índice mensal do IPCA
// e grava em indices/ipca.json. Rodar quando sair o índice de um mês novo.
// Uso: npm run ipca
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const URL_SIDRA = 'https://apisidra.ibge.gov.br/values/t/1737/n1/all/v/2266/p/all/d/v2266%2013';
const destino = resolve(import.meta.dirname, '../../../indices/ipca.json');

const linhas = (await (await fetch(URL_SIDRA)).json()) as { V: string; D3C: string }[];
const mensal: Record<string, number> = {};
for (const l of linhas.slice(1)) {
  const v = Number(l.V);
  if (l.D3C >= '200001' && Number.isFinite(v)) mensal[`${l.D3C.slice(0, 4)}-${l.D3C.slice(4)}`] = v;
}
const meses = Object.keys(mensal);
writeFileSync(destino, JSON.stringify({
  fonte: 'IBGE, SIDRA tabela 1737, variável 2266 — IPCA, número-índice (dez/1993 = 100)',
  baixado_em: new Date().toISOString().slice(0, 10),
  mensal,
}, null, 1) + '\n');
console.log(`${destino}: ${meses.length} meses, de ${meses[0]} a ${meses.at(-1)}`);
