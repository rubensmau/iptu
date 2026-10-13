// Carrega um perfil de município e um caso, e confere:
//  - campos ainda vazios (o que o app terá de pedir ao proprietário);
//  - campos preenchidos sem origem registrada;
//  - se os números do lançamento fecham entre si.
// Uso: npm run confere -- [casos/arquivo.json]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { r2, tributos, valorImplicito } from './calc.js';
import type { Caso, PerfilMunicipio } from './tipos.js';

const raiz = resolve(import.meta.dirname, '../../..');
const lerJson = <T>(caminho: string): T => JSON.parse(readFileSync(resolve(raiz, caminho), 'utf-8'));

const caso = lerJson<Caso>(process.argv[2] ?? 'casos/exemplo_porto.json');
const perfil = lerJson<PerfilMunicipio>(`municipios/${caso.municipio}.json`);

/** Caminhos com ponto de todas as folhas, sem descer em listas. */
function folhas(obj: unknown, prefixo = ''): [string, unknown][] {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return [[prefixo, obj]];
  return Object.entries(obj).flatMap(([k, v]) => folhas(v, prefixo ? `${prefixo}.${k}` : k));
}

const dados = { requerente: caso.requerente, imovel: caso.imovel, lancamento: caso.lancamento };
const todas = folhas(dados);
const vazios = todas.filter(([, v]) => v === null || v === undefined).map(([k]) => k);
// a origem pode estar registrada no campo ou em um dos seus pais ("lancamento")
const temOrigem = (k: string) => k.split('.').some((_, i, p) => p.slice(0, i + 1).join('.') in caso.origens);
const semOrigem = todas.filter(([k, v]) => v !== null && v !== undefined && !temOrigem(k)).map(([k]) => k);

const l = caso.lancamento;
const checks: [string, number, number][] = [];
if (l.valor_venal_terreno != null && l.valor_venal_edificacao != null && l.valor_venal_imovel != null) {
  const t = tributos(perfil, l.valor_venal_terreno, l.valor_venal_edificacao, caso.imovel.area_construida_m2);
  checks.push(['VVT + VVC = VVI', t.valor_venal_imovel, l.valor_venal_imovel]);
  checks.push([`IPTU (${(t.faixa.aliquota * 100).toFixed(2)}%, ${perfil.tributacao.arredondamento})`, t.iptu_anual, l.iptu_anual ?? NaN]);
  if (t.lixo_anual != null) checks.push(['lixo (R$/m² × área)', t.lixo_anual, l.lixo_anual ?? NaN]);
}
if (l.iptu_anual != null && l.lixo_anual != null) checks.push(['IPTU + lixo = total', r2(l.iptu_anual + l.lixo_anual), l.total_lancado ?? NaN]);

console.log(`Município: ${perfil.nome}/${perfil.uf} (${perfil.exercicio}) — ${perfil.fonte_dados}`);
console.log(`\nCampos vazios (${vazios.length}):`);
vazios.forEach((k) => console.log(`  - ${k}  [${caso.origens[k]?.fonte ?? '?'}]`));
console.log(`\nPreenchidos sem origem (${semOrigem.length}):`);
semOrigem.forEach((k) => console.log(`  - ${k}`));
console.log('\nConferência do lançamento:');
for (const [nome, calc, lancado] of checks) {
  console.log(`  ${calc === lancado ? 'ok ' : 'DIF'} ${nome}: calculado ${calc.toFixed(2)} × lançado ${lancado.toFixed(2)}`);
}
const implicito = valorImplicito(caso, perfil);
if (implicito) {
  console.log(`\nValor efetivo da construção: R$ ${implicito.efetivo.toFixed(2)}/m²`);
  for (const p of implicito.padroes) {
    console.log(`  ${p.tipologia} ${p.padrao} (R$ ${p.valor_m2.toFixed(2)}): FC implícito ${p.fc_implicito.toFixed(4)}` +
      ` — tabela: ${Object.entries(perfil.fatores_conservacao).map(([c, fc]) => `${c} ${fc.toFixed(2)}`).join(', ')}`);
  }
}
console.log(`\nAlertas (${caso.alertas.length}):`);
caso.alertas.forEach((a) => console.log(`  - ${a}`));
console.log(`\nPendências do perfil (${perfil.pendencias.length}):`);
perfil.pendencias.forEach((p) => console.log(`  - ${p}`));
