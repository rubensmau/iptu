// Cálculo do lançamento e da simulação de revisão.
//
// VVC = AC × VM²C × FC (Mogi Mirim: LC 392/2025, art. 5º, II); VVI = VVT + VVC;
// com blocos acessórios (garagem, área de serviço como Telheiro...), o VVC é a soma
// de cada bloco pela sua área, e o corpo principal fica com a área restante;
// vale a área do cadastro: se a vistoria mediu também o corpo principal e a soma
// medida diverge dela, cada área medida é multiplicada por cadastro ÷ vistoria;
// a alíquota sai da faixa do VVI e vale para as duas parcelas do imposto
// (territorial e predial). Com arredondamento "por_parcela", cada parcela mensal
// é arredondada e o anual é parcela × n — é assim que o carnê de Mogi Mirim fecha.
import type { BlocoConstrucao, Caso, FaixaAliquota, PerfilMunicipio } from './tipos.js';

/** Arredonda a centavos sem o erro de 1.005 → 1.00. */
export const r2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;

export interface Cenario {
  tipologia: string;
  padrao: string;
  conservacao: string;     // chave de fatores_conservacao
  area_m2?: number;        // área construída TOTAL; padrão: a do cadastro
  valor_venal_terreno?: number; // padrão: VVT lançado
  acessorias?: BlocoConstrucao[]; // blocos à parte; só entram os que têm área
}

export interface BlocoCalculado {
  descricao: string;
  tipologia: string;
  padrao: string;
  conservacao: string;
  area_m2: number;
  valor_m2_tabela: number;
  fator_conservacao: number;
  valor_m2_efetivo: number;
  vvc: number;
}

/** Áreas da vistoria levadas à área do cadastro (que é a base do lançamento). */
export interface AjusteArea {
  area_cadastro: number;
  area_vistoria: number;   // corpo principal + blocos medidos
  fator: number;           // cadastro ÷ vistoria
  blocos: { descricao: string; medida: number; ajustada: number }[];
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
  blocos: BlocoCalculado[];   // [0] = corpo principal; os demais, acessórios (áreas já ajustadas)
  ajuste_area: AjusteArea | null; // só quando a área medida na vistoria diverge do cadastro
  valor_m2_tabela: number;    // do corpo principal
  fator_conservacao: number;
  valor_m2_efetivo: number;
  revisado: Tributos;
  atual: Tributos | null;     // recalculado a partir do lançamento, para comparar
  reducao_vvi: number | null;
  reducao_iptu: number | null;
  reducao_total: number | null;
  memoria: string[];          // linhas prontas para o requerimento
  memoria_ajuste: string[];   // o ajuste das áreas: só na memória da tela, não no requerimento
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

/** Blocos acessórios do caso que dá para calcular (com área e padrão existente no perfil). */
export function acessoriasValidas(blocos: BlocoConstrucao[] | undefined, perfil: PerfilMunicipio): BlocoConstrucao[] {
  return (blocos ?? []).filter((b) => b.area_m2 != null && b.area_m2 > 0 &&
    perfil.valores_construcao[b.tipologia]?.[b.padrao]?.valor_m2 != null && perfil.fatores_conservacao[b.conservacao] != null);
}

function bloco(perfil: PerfilMunicipio, descricao: string, tipologia: string, padrao: string, conservacao: string, area: number): BlocoCalculado {
  const valor = perfil.valores_construcao[tipologia]?.[padrao]?.valor_m2;
  if (valor == null) throw new Error(`${perfil.nome}: sem valor/m² para ${tipologia} ${padrao}`);
  const fc = perfil.fatores_conservacao[conservacao];
  if (fc == null) throw new Error(`${perfil.nome}: estado de conservação desconhecido: ${conservacao}`);
  const efetivo = r2(valor * fc);
  return { descricao, tipologia, padrao, conservacao, area_m2: area, valor_m2_tabela: valor, fator_conservacao: fc, valor_m2_efetivo: efetivo, vvc: r2(area * efetivo) };
}

export function simular(caso: Caso, perfil: PerfilMunicipio, c: Cenario): Simulacao {
  const area = c.area_m2 ?? caso.imovel.area_construida_m2;
  const vvt = c.valor_venal_terreno ?? caso.lancamento.valor_venal_terreno;
  if (area == null) throw new Error('falta a área construída');
  if (vvt == null) throw new Error('falta o valor venal do terreno');
  const medidas = acessoriasValidas(c.acessorias, perfil);
  const principalMedido = caso.classificacao.area_principal_m2 ?? null;
  const areaVistoria = principalMedido && principalMedido > 0 ? r2(principalMedido + medidas.reduce((t, b) => t + b.area_m2!, 0)) : null;
  const fator = areaVistoria != null && Math.abs(areaVistoria - area) >= 0.01 ? area / areaVistoria : 1;
  const acessorias = medidas.map((b) => ({ ...b, area_m2: r2(b.area_m2! * fator) }));
  const areaAcessorias = r2(acessorias.reduce((t, b) => t + b.area_m2!, 0));
  const areaPrincipal = r2(area - areaAcessorias);
  if (areaPrincipal <= 0) throw new Error(`as áreas acessórias (${num(areaAcessorias)} m²) somam mais que a área construída (${num(area)} m²) — informe também a área medida do corpo principal para ajustá-las à área do cadastro`);
  const ajuste: AjusteArea | null = fator === 1 ? null : {
    area_cadastro: area, area_vistoria: areaVistoria!, fator,
    blocos: [{ descricao: 'Corpo principal', medida: principalMedido!, ajustada: areaPrincipal },
      ...medidas.map((b, i) => ({ descricao: b.descricao, medida: b.area_m2!, ajustada: acessorias[i].area_m2! }))],
  };

  const principal = bloco(perfil, acessorias.length ? 'Corpo principal' : 'Construção', c.tipologia, c.padrao, c.conservacao, areaPrincipal);
  const blocos = [principal, ...acessorias.map((b) => bloco(perfil, b.descricao, b.tipologia, b.padrao, b.conservacao, b.area_m2!))];
  const vvc = r2(blocos.reduce((t, b) => t + b.vvc, 0));
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
  const linhaBloco = (b: BlocoCalculado) =>
    `${b.descricao} — ${b.tipologia} ${b.padrao}, estado ${b.conservacao}: ${num(b.area_m2)} m² × ${brl(b.valor_m2_tabela)}/m² × ${num(b.fator_conservacao)} = ${brl(b.vvc)}.`;
  const memoria = blocos.length === 1
    ? [
        `Valor unitário efetivo de ${c.tipologia} ${c.padrao} em estado ${c.conservacao}: ${brl(principal.valor_m2_tabela)}/m² × ${num(principal.fator_conservacao)} = ${brl(principal.valor_m2_efetivo)}/m².`,
        `VVC revisado: ${num(area)} m² × ${brl(principal.valor_m2_efetivo)}/m² = ${brl(vvc)}.`,
      ]
    : [
        `Área construída de ${num(area)} m² dividida em ${blocos.length} blocos: ${num(areaPrincipal)} m² de corpo principal e ${num(areaAcessorias)} m² enquadrados à parte.`,
        ...blocos.map(linhaBloco),
        `VVC revisado: ${blocos.map((b) => brl(b.vvc)).join(' + ')} = ${brl(vvc)}.`,
      ];
  memoria.push(
    `VVI revisado: ${brl(vvt)} + ${brl(vvc)} = ${brl(revisado.valor_venal_imovel)}.`,
    revisado.territorial_mensal != null
      ? `IPTU revisado: (${brl(revisado.territorial_mensal)} territorial + ${brl(revisado.predial_mensal!)} predial) × ${perfil.tributacao.parcelas} parcelas = ${brl(revisado.iptu_anual)}, alíquota de ${pct(revisado.faixa.aliquota)} (${revisado.faixa.ref}).`
      : `IPTU revisado: ${brl(revisado.valor_venal_imovel)} × ${pct(revisado.faixa.aliquota)} = ${brl(revisado.iptu_anual)} (${revisado.faixa.ref}).`,
  );
  const f4 = (x: number) => x.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const memoria_ajuste = ajuste ? [
    `Área medida na vistoria: ${ajuste.blocos.map((b) => num(b.medida)).join(' + ')} = ${num(ajuste.area_vistoria)} m²; área construída do cadastro: ${num(area)} m² (${pct(area / ajuste.area_vistoria - 1).replace(/^(?!-)/, '+')}). Vale a do cadastro.`,
    `Fator de ajuste das áreas: ${num(area)} ÷ ${num(ajuste.area_vistoria)} = ${f4(fator)}.`,
    ...ajuste.blocos.map((b, i) => `${b.descricao}: ${num(b.medida)} m² × ${f4(fator)} ${i ? '=' : '≈'} ${num(b.ajustada)} m²${i ? '' : ' (área do cadastro menos os demais blocos)'}.`),
  ] : [];
  return {
    cenario: { ...c, area_m2: area, valor_venal_terreno: vvt, acessorias },
    blocos, ajuste_area: ajuste, memoria_ajuste,
    valor_m2_tabela: principal.valor_m2_tabela, fator_conservacao: principal.fator_conservacao, valor_m2_efetivo: principal.valor_m2_efetivo,
    revisado, atual,
    reducao_vvi: vviLancado != null ? r2(vviLancado - revisado.valor_venal_imovel) : null,
    reducao_iptu: iptuLancado != null ? r2(iptuLancado - revisado.iptu_anual) : null,
    reducao_total: totalLancado != null ? r2(totalLancado - revisado.total) : null,
    memoria,
  };
}

/**
 * Cenários do corpo principal na tipologia do caso (padrão × conservação), do menor
 * IPTU para o maior; os blocos acessórios entram como estão na classificação.
 */
export function cenarios(caso: Caso, perfil: PerfilMunicipio, tipologia?: string): Simulacao[] {
  const t = tipologia ?? caso.classificacao.tipologia ?? Object.keys(perfil.valores_construcao)[0];
  const out: Simulacao[] = [];
  for (const [padrao, p] of Object.entries(perfil.valores_construcao[t] ?? {})) {
    if (p.valor_m2 == null) continue;
    for (const conservacao of Object.keys(perfil.fatores_conservacao)) {
      try {
        out.push(simular(caso, perfil, { tipologia: t, padrao, conservacao, acessorias: caso.classificacao.acessorias }));
      } catch { /* cenário que não fecha (ex.: acessórias maiores que a área) */ }
    }
  }
  return out.sort((a, b) => a.revisado.iptu_anual - b.revisado.iptu_anual);
}

/**
 * Engenharia reversa do lançamento: valor efetivo por m², o FC que ele daria em cada
 * padrão da tipologia e, como hipótese, quantos m² precisariam estar como Telheiro
 * (estado Bom) para o valor fechar com um FC da tabela — o carnê não diz como a
 * prefeitura dividiu a construção.
 */
export function valorImplicito(caso: Caso, perfil: PerfilMunicipio) {
  const { valor_venal_edificacao: vvc } = caso.lancamento;
  const area = caso.imovel.area_construida_m2;
  if (vvc == null || !area) return null;
  const efetivo = r2(vvc / area);
  const tipologia = caso.classificacao.tipologia ?? caso.imovel.tipo_cadastro ?? 'Casa';
  const tabela = Object.entries(perfil.valores_construcao[tipologia] ?? {}).filter(([, p]) => p.valor_m2 != null);
  const padroes = tabela.map(([padrao, p]) =>
    ({ tipologia, padrao, valor_m2: p.valor_m2!, fc_implicito: Math.round((efetivo / p.valor_m2!) * 10000) / 10000 }));
  const blocos: { padrao: string; conservacao: string; telheiro: string; area_principal: number; area_telheiro: number }[] = [];
  const telheiros = Object.entries(perfil.valores_construcao.Telheiro ?? {}).filter(([, p]) => p.valor_m2 != null);
  if (tipologia !== 'Telheiro') {
    for (const [padrao, p] of tabela) {
      for (const [conservacao, fc] of Object.entries(perfil.fatores_conservacao)) {
        for (const [tp, t] of telheiros) {
          const vp = p.valor_m2! * fc, vt = t.valor_m2!;
          const a = (vvc - area * vt) / (vp - vt);
          // só hipóteses plausíveis: corpo principal de pelo menos 60% da área
          if (vp > vt && a >= area * 0.6 && a < area - 0.5) {
            blocos.push({ padrao, conservacao, telheiro: tp, area_principal: r2(a), area_telheiro: r2(area - a) });
          }
        }
      }
    }
  }
  return { efetivo, padroes, blocos };
}

const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const brl = (x: number) => `R$ ${fmt.format(x)}`;
export const num = (x: number) => fmt.format(x);
