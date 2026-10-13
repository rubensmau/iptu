// Cálculo do lançamento e da simulação de revisão.
//
// VVC = AC × VM²C × FC (Mogi Mirim: LC 392/2025, art. 5º, II); VVI = VVT + VVC;
// a alíquota sai da faixa do VVI e vale para as duas parcelas do imposto
// (territorial e predial). Com arredondamento "por_parcela", cada parcela mensal
// é arredondada e o anual é parcela × n — é assim que o carnê de Mogi Mirim fecha.
import type { Caso, FaixaAliquota, PerfilMunicipio } from './tipos.js';

/** Arredonda a centavos sem o erro de 1.005 → 1.00. */
export const r2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;

export interface Cenario {
  tipologia: string;
  padrao: string;
  conservacao: string;     // chave de fatores_conservacao
  area_m2?: number;        // padrão: área construída do cadastro
  valor_venal_terreno?: number; // padrão: VVT lançado
}

export interface Tributos {
  valor_venal_terreno: number;
  valor_venal_edificacao: number;
  valor_venal_imovel: number;
  faixa: FaixaAliquota;
  territorial_mensal: number | null; // só com arredondamento por parcela
  predial_mensal: number | null;
  iptu_anual: number;
  lixo_anual: number | null;
  total: number;
}

export interface Simulacao {
  cenario: Required<Cenario>;
  valor_m2_tabela: number;
  fator_conservacao: number;
  valor_m2_efetivo: number;
  revisado: Tributos;
  atual: Tributos | null;     // recalculado a partir do lançamento, para comparar
  reducao_vvi: number | null;
  reducao_iptu: number | null;
  reducao_total: number | null;
  memoria: string[];          // linhas prontas para o requerimento
}

export const faixaDe = (perfil: PerfilMunicipio, vvi: number): FaixaAliquota => {
  const f = perfil.tributacao.faixas_predial.find((x) => x.ate === null || vvi <= x.ate);
  if (!f) throw new Error(`${perfil.nome}: sem alíquota cadastrada para valor venal de ${brl(vvi)}`);
  return f;
};

/** IPTU e lixo para um par VVT/VVC, pelas regras do município. */
export function tributos(perfil: PerfilMunicipio, vvt: number, vvc: number, area_m2: number | null, lixoLancado?: number | null): Tributos {
  const t = perfil.tributacao;
  const vvi = r2(vvt + vvc);
  const faixa = faixaDe(perfil, vvi);
  let territorial_mensal = null, predial_mensal = null, iptu: number, lixo: number | null = null;
  if (t.arredondamento === 'por_parcela') {
    territorial_mensal = r2((vvt * faixa.aliquota) / t.parcelas);
    predial_mensal = r2((vvc * faixa.aliquota) / t.parcelas);
    iptu = r2((territorial_mensal + predial_mensal) * t.parcelas);
    if (t.lixo_valor_m2 != null && area_m2 != null) lixo = r2(r2((t.lixo_valor_m2 * area_m2) / t.parcelas) * t.parcelas);
  } else {
    iptu = r2(vvi * faixa.aliquota);
    if (t.lixo_valor_m2 != null && area_m2 != null) lixo = r2(t.lixo_valor_m2 * area_m2);
  }
  lixo ??= lixoLancado ?? null;
  return {
    valor_venal_terreno: vvt, valor_venal_edificacao: vvc, valor_venal_imovel: vvi, faixa,
    territorial_mensal, predial_mensal, iptu_anual: iptu, lixo_anual: lixo, total: r2(iptu + (lixo ?? 0)),
  };
}

export function simular(caso: Caso, perfil: PerfilMunicipio, c: Cenario): Simulacao {
  const padrao = perfil.valores_construcao[c.tipologia]?.[c.padrao];
  if (padrao?.valor_m2 == null) throw new Error(`${perfil.nome}: sem valor/m² para ${c.tipologia} ${c.padrao}`);
  const fc = perfil.fatores_conservacao[c.conservacao];
  if (fc == null) throw new Error(`${perfil.nome}: estado de conservação desconhecido: ${c.conservacao}`);
  const area = c.area_m2 ?? caso.imovel.area_construida_m2;
  const vvt = c.valor_venal_terreno ?? caso.lancamento.valor_venal_terreno;
  if (area == null) throw new Error('falta a área construída');
  if (vvt == null) throw new Error('falta o valor venal do terreno');

  const efetivo = r2(padrao.valor_m2 * fc);
  const vvc = r2(area * efetivo);
  const l = caso.lancamento;
  const revisado = tributos(perfil, vvt, vvc, area, l.lixo_anual);
  const atual = l.valor_venal_terreno != null && l.valor_venal_edificacao != null
    ? tributos(perfil, l.valor_venal_terreno, l.valor_venal_edificacao, caso.imovel.area_construida_m2, l.lixo_anual)
    : null;
  // a redução se mede contra o que foi cobrado (carnê), não contra o recálculo
  const vviLancado = l.valor_venal_imovel ?? atual?.valor_venal_imovel ?? null;
  const iptuLancado = l.iptu_anual ?? atual?.iptu_anual ?? null;
  const totalLancado = l.total_lancado ?? atual?.total ?? null;

  const pct = (a: number) => `${(a * 100).toFixed(2).replace('.', ',')}%`;
  const memoria = [
    `Valor unitário efetivo de ${c.tipologia} ${c.padrao} em estado ${c.conservacao}: ${brl(padrao.valor_m2)}/m² × ${num(fc)} = ${brl(efetivo)}/m².`,
    `VVC revisado: ${num(area)} m² × ${brl(efetivo)}/m² = ${brl(vvc)}.`,
    `VVI revisado: ${brl(vvt)} + ${brl(vvc)} = ${brl(revisado.valor_venal_imovel)}.`,
    revisado.territorial_mensal != null
      ? `IPTU revisado: (${brl(revisado.territorial_mensal)} territorial + ${brl(revisado.predial_mensal!)} predial) × ${perfil.tributacao.parcelas} parcelas = ${brl(revisado.iptu_anual)}, alíquota de ${pct(revisado.faixa.aliquota)} (${revisado.faixa.ref}).`
      : `IPTU revisado: ${brl(revisado.valor_venal_imovel)} × ${pct(revisado.faixa.aliquota)} = ${brl(revisado.iptu_anual)} (${revisado.faixa.ref}).`,
  ];
  return {
    cenario: { ...c, area_m2: area, valor_venal_terreno: vvt },
    valor_m2_tabela: padrao.valor_m2, fator_conservacao: fc, valor_m2_efetivo: efetivo,
    revisado, atual,
    reducao_vvi: vviLancado != null ? r2(vviLancado - revisado.valor_venal_imovel) : null,
    reducao_iptu: iptuLancado != null ? r2(iptuLancado - revisado.iptu_anual) : null,
    reducao_total: totalLancado != null ? r2(totalLancado - revisado.total) : null,
    memoria,
  };
}

/** Todos os cenários que o perfil permite calcular, do menor IPTU para o maior. */
export function cenarios(caso: Caso, perfil: PerfilMunicipio): Simulacao[] {
  const out: Simulacao[] = [];
  for (const [tipologia, padroes] of Object.entries(perfil.valores_construcao)) {
    for (const [padrao, p] of Object.entries(padroes)) {
      if (p.valor_m2 == null) continue;
      for (const conservacao of Object.keys(perfil.fatores_conservacao)) {
        out.push(simular(caso, perfil, { tipologia, padrao, conservacao }));
      }
    }
  }
  return out.sort((a, b) => a.revisado.iptu_anual - b.revisado.iptu_anual);
}

/** Valor efetivo por m² que o lançamento implica, e o FC que ele daria em cada padrão. */
export function valorImplicito(caso: Caso, perfil: PerfilMunicipio) {
  const { valor_venal_edificacao: vvc } = caso.lancamento;
  const area = caso.imovel.area_construida_m2;
  if (vvc == null || !area) return null;
  const efetivo = r2(vvc / area);
  const padroes = Object.entries(perfil.valores_construcao).flatMap(([tipologia, ps]) =>
    Object.entries(ps).flatMap(([padrao, p]) =>
      p.valor_m2 == null ? [] : [{ tipologia, padrao, valor_m2: p.valor_m2, fc_implicito: Math.round((efetivo / p.valor_m2) * 10000) / 10000 }]));
  return { efetivo, padroes };
}

const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const brl = (x: number) => `R$ ${fmt.format(x)}`;
export const num = (x: number) => fmt.format(x);
