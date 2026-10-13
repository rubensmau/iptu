// Simula a revisão de um caso: quadro comparativo, memória de cálculo e todos os cenários.
// Uso: npm run simula -- [casos/x.json] [--tipologia Casa --padrao Popular --conservacao Regular] [--area 124.12]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { brl, cenarios, num, simular, valorImplicito } from './calc.js';
import type { Caso, PerfilMunicipio } from './tipos.js';

const raiz = resolve(import.meta.dirname, '../../..');
const lerJson = <T>(caminho: string): T => JSON.parse(readFileSync(resolve(raiz, caminho), 'utf-8'));
const args = process.argv.slice(2);
const opcao = (nome: string) => { const i = args.indexOf(`--${nome}`); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const tipologia = opcao('tipologia'), padrao = opcao('padrao'), conservacao = opcao('conservacao'), area = opcao('area');

const caso = lerJson<Caso>(args[0] ?? 'casos/exemplo_porto.json');
const perfil = lerJson<PerfilMunicipio>(`municipios/${caso.municipio}.json`);
const cl = caso.classificacao;
const cenario = {
  tipologia: tipologia ?? cl.tipologia ?? 'Casa',
  padrao: padrao ?? cl.padrao ?? '',
  conservacao: conservacao ?? cl.conservacao ?? '',
  ...(area ? { area_m2: Number(area.replace(',', '.')) } : {}),
};
if (!cenario.padrao || !cenario.conservacao) {
  console.error('caso sem classificação: informe --padrao e --conservacao');
  process.exit(1);
}

let s;
try {
  s = simular(caso, perfil, cenario);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
const l = caso.lancamento;
const pct = (a: number) => `${(a * 100).toFixed(2).replace('.', ',')}%`;
const linha = (item: string, atual: string, rev: string, obs = '') =>
  console.log(`  ${item.padEnd(26)}${atual.padEnd(18)}${rev.padEnd(18)}${obs}`);
const v = (x: number | null | undefined) => (x == null ? '—' : brl(x));

console.log(`${perfil.nome}/${perfil.uf} — cenário: ${s.cenario.tipologia} ${s.cenario.padrao}, ${s.cenario.conservacao} (FC ${num(s.fator_conservacao)})\n`);
linha('Item', 'Lançamento', 'Revisão');
linha('Área da construção', `${num(caso.imovel.area_construida_m2 ?? NaN)} m²`, `${num(s.cenario.area_m2)} m²`);
linha('Valor efetivo/m²', v(valorImplicito(caso, perfil)?.efetivo), v(s.valor_m2_efetivo),
  `${brl(s.valor_m2_tabela)} × ${num(s.fator_conservacao)}`);
linha('Valor venal do terreno', v(l.valor_venal_terreno), v(s.revisado.valor_venal_terreno));
linha('Valor venal da construção', v(l.valor_venal_edificacao), v(s.revisado.valor_venal_edificacao));
linha('Valor venal total', v(l.valor_venal_imovel), v(s.revisado.valor_venal_imovel), s.reducao_vvi != null ? `redução de ${brl(s.reducao_vvi)}` : '');
linha('Alíquota', s.atual ? pct(s.atual.faixa.aliquota) : '—', pct(s.revisado.faixa.aliquota), s.revisado.faixa.ref);
linha('IPTU anual', v(l.iptu_anual), v(s.revisado.iptu_anual), s.reducao_iptu != null ? `redução de ${brl(s.reducao_iptu)}` : '');
linha('Coleta de lixo', v(l.lixo_anual), v(s.revisado.lixo_anual));
linha('Total anual', v(l.total_lancado), v(s.revisado.total), s.reducao_total != null ? `redução de ${brl(s.reducao_total)}` : '');
if (s.atual && l.iptu_anual != null && s.atual.iptu_anual !== l.iptu_anual) {
  console.log(`\n  ATENÇÃO: o recálculo do lançamento dá ${brl(s.atual.iptu_anual)}, o carnê diz ${brl(l.iptu_anual)}.`);
}

console.log('\nMemória:');
s.memoria.forEach((m) => console.log(`  ${m}`));

console.log('\nTodos os cenários do perfil (menor IPTU primeiro):');
for (const c of cenarios(caso, perfil)) {
  console.log(`  ${`${c.cenario.tipologia} ${c.cenario.padrao} ${c.cenario.conservacao}`.padEnd(28)}` +
    `VVI ${brl(c.revisado.valor_venal_imovel).padEnd(15)} IPTU ${brl(c.revisado.iptu_anual).padEnd(11)} (${pct(c.revisado.faixa.aliquota)})` +
    (c.reducao_iptu != null ? `  ${c.reducao_iptu >= 0 ? 'reduz' : 'AUMENTA'} ${brl(Math.abs(c.reducao_iptu))}` : ''));
}
