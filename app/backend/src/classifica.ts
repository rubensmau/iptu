// Classifica um caso pela Claude API e grava o resultado num novo arquivo.
// Uso: npm run classifica -- <casos/x.json> --saida <saida.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { classificar } from './classificar.js';
import type { Caso, PerfilMunicipio } from './tipos.js';

const raiz = resolve(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
const i = args.indexOf('--saida');
const saida = i >= 0 ? args.splice(i, 2)[1] : undefined;
if (!args[0] || !saida) {
  console.error('uso: npm run classifica -- <casos/x.json> --saida <saida.json>');
  process.exit(1);
}

const caso: Caso = JSON.parse(readFileSync(resolve(raiz, args[0]), 'utf-8'));
const perfil: PerfilMunicipio = JSON.parse(readFileSync(resolve(raiz, `municipios/${caso.municipio}.json`), 'utf-8'));

const inicio = Date.now();
const r = await classificar(caso, perfil);
const c = r.classificacao;
console.log(`${r.uso.modelo}: ${r.uso.entrada} tokens de entrada, ${r.uso.saida} de saída, ${((Date.now() - inicio) / 1000).toFixed(0)} s`);
console.log(`\nSugestão: ${c.tipologia} ${c.padrao}, ${c.conservacao} (confiança ${c.confianca})`);
console.log('\nCaracterísticas:');
c.caracteristicas.forEach((e) => console.log(`  - ${e.elemento}: ${e.evidencias} → ${e.conclusao}`));
console.log('\nEstado:');
c.estado.forEach((e) => console.log(`  - ${e.elemento}: ${e.evidencias} → ${e.conclusao}`));
console.log(`\nÁreas acessórias: ${c.areas_acessorias}`);
console.log('\nPontos fracos:');
c.pontos_fracos.forEach((p) => console.log(`  - ${p}`));
console.log('\nConfirmações para o proprietário:');
for (const q of r.confirmacoes) {
  console.log(`  [${q.id}] ${q.pergunta}\n      opções: ${q.opcoes.join(' | ')}  → sugestão: ${q.sugestao}\n      ${q.justificativa}`);
  if (q.impacto) console.log(`      impacto: ${q.impacto}`);
}
r.alertas.forEach((a) => console.log(`\n${a}`));

const origem = { fonte: 'julgamento' as const, ref: `${r.uso.modelo}, a confirmar pelo proprietário` };
const novo: Caso = {
  ...caso,
  classificacao: c,
  confirmacoes: r.confirmacoes,
  alertas: [...caso.alertas, ...r.alertas],
  origens: {
    ...caso.origens,
    'classificacao.tipologia': origem, 'classificacao.padrao': origem, 'classificacao.conservacao': origem,
    'classificacao.caracteristicas': origem, 'classificacao.estado': origem,
  },
};
writeFileSync(saida, JSON.stringify(novo, null, 2) + '\n', 'utf-8');
console.log(`\nGravado em ${saida}`);
