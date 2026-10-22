// Sugere tipologia, padrão e estado de conservação a partir das observações do
// laudo, à luz do perfil do município — sempre como sugestão: cada critério
// subjetivo vira uma Confirmacao que a tela pergunta ao proprietário.
//
// O efeito financeiro de cada opção de conservação é calculado aqui (calc.ts),
// não pelo modelo: inclusive o risco de a vistoria concluir "Bom" e o IPTU subir.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { brl, simular } from './calc.js';
import { normaliza } from './cruzamento.js';
import type { BlocoConstrucao, Caso, Classificacao, Confirmacao, PerfilMunicipio } from './tipos.js';

const MODELO = 'claude-opus-5-5';

const SISTEMA = `Você ajuda proprietários de imóveis a pedir revisão do IPTU à prefeitura.
Recebe o perfil legal do município (tabela de padrões construtivos, fatores de conservação, critérios da lei)
e o laudo de vistoria do imóvel, e sugere o enquadramento que a prefeitura deveria aplicar.

Regras:
- Baseie-se apenas no texto do laudo. Cite as evidências com o número e o nome do ambiente (ex.: "11. Área de Serviço").
  Se houver descrição da construção na matrícula, use-a como evidência complementar (ex.: "forrada em parte"), citando "matrícula".
- Laudos de vistoria de locação costumam marcar todo item como "em bom estado" por padrão do sistema;
  o que vale são as observações. Mesmo assim, aponte esse título como ponto fraco do pedido.
- Considere a predominância dos elementos no conjunto do imóvel, não o pior item isolado.
- Seja honesto: se as evidências apoiam um estado melhor que o pedido, diga. O proprietário vai decidir.
- Só use padrões e estados que existem no perfil. Se o imóvel não se encaixa em nenhum padrão disponível, diga isso na justificativa.
- Compare o imóvel com a descrição de CADA padrão da tipologia (Anexo IV), não só com o sugerido: aponte os requisitos
  que o imóvel não cumpre (ex.: o padrão Popular pede forro; o Precário descreve cobertura sem forro).
- Classifique por ambiente: partes da construção que se encaixam em outra tipologia (ex.: Telheiro — só cobertura e
  apoios, sem fechamentos laterais — para garagem ou área de serviço) devem ir em "acessorias", cada uma com tipologia,
  padrão e estado próprios. O pedido calcula o valor de cada bloco proporcional aos seus m²; o laudo não traz a área
  de cada ambiente, então não invente metragem.
- O laudo de vistoria de locação não tem ART: ele vale como relatório fotográfico do estado do imóvel.
- Cada critério subjetivo (padrão, estado de conservação, áreas acessórias como garagem e área de serviço,
  e qualquer outra dúvida relevante) deve virar uma confirmação para o proprietário, com opções fechadas e uma sugestão.
- Escreva em português do Brasil, em texto adequado para constar num requerimento à prefeitura.`;

function esquema(perfil: PerfilMunicipio) {
  const tipologias = Object.keys(perfil.valores_construcao) as [string, ...string[]];
  const padroes = [...new Set(Object.values(perfil.valores_construcao).flatMap((p) => Object.keys(p)))] as [string, ...string[]];
  const estados = Object.keys(perfil.fatores_conservacao) as [string, ...string[]];
  const elemento = z.object({
    elemento: z.string().describe('ex.: Paredes e revestimentos, Pisos, Cobertura, Esquadrias, Instalações'),
    evidencias: z.string().describe('o que o laudo diz, citando os ambientes'),
    conclusao: z.string(),
  });
  return z.object({
    tipologia: z.enum(tipologias),
    padrao: z.enum(padroes),
    conservacao: z.enum(estados),
    confianca: z.enum(['alta', 'media', 'baixa']),
    caracteristicas: z.array(elemento).describe('características construtivas por elemento (define o padrão)'),
    estado: z.array(elemento).describe('estado de conservação por elemento (define o fator de conservação)'),
    areas_acessorias: z.string().describe('garagem, área de serviço, telheiros: como deveriam ser classificadas'),
    acessorias: z.array(z.object({
      descricao: z.string().describe('ex.: Garagem, Área de serviço'),
      ambientes: z.string().describe('ambientes do laudo, com número: "2. Garagem"'),
      tipologia: z.enum(tipologias),
      padrao: z.enum(padroes),
      conservacao: z.enum(estados),
    })).describe('partes da construção a enquadrar separadamente do corpo principal; vazio se não houver'),
    pontos_fracos: z.array(z.string()).describe('o que a prefeitura pode usar contra o pedido'),
    confirmacoes: z.array(z.object({
      id: z.string().describe('identificador curto: padrao, conservacao, garagem, area_servico...'),
      pergunta: z.string(),
      opcoes: z.array(z.string()).describe('para padrão e conservação, use exatamente os nomes do perfil (ex.: "Regular"), sem números'),
      sugestao: z.string().describe('uma das opções, idêntica'),
      justificativa: z.string(),
    })),
  });
}

function contexto(caso: Caso, perfil: PerfilMunicipio): string {
  const normas = perfil.normas.map((n) =>
    `${n.tipo} ${n.numero}/${n.ano} (${n.descricao}):\n` +
    Object.entries(n.artigos).map(([a, t]) => `  - ${a}: ${t}`).join('\n')).join('\n');
  // só a tipologia do caso e o Telheiro: a tabela inteira encheria o contexto à toa
  const tipoCaso = caso.classificacao.tipologia ?? caso.imovel.tipo_cadastro ?? laudoCategoria(caso);
  const relevantes = Object.entries(perfil.valores_construcao)
    .filter(([tipo]) => !tipoCaso || tipo === tipoCaso || tipo === 'Telheiro' || !(tipoCaso in perfil.valores_construcao));
  const padroes = relevantes.flatMap(([tipo, ps]) =>
    Object.entries(ps).map(([p, v]) => `  - ${tipo} ${p}: ${v.valor_m2 != null ? brl(v.valor_m2) + '/m²' : 'valor não levantado'}. ${v.descricao ?? ''}`));
  const fcs = Object.entries(perfil.fatores_conservacao).map(([e, f]) => `${e} = ${f.toFixed(2)}`).join('; ');
  const laudo = caso.laudo;
  return [
    `# Município: ${perfil.nome}/${perfil.uf}, exercício ${perfil.exercicio}`,
    normas,
    `\nPadrões construtivos (Anexos II e IV) das tipologias relevantes; outras tipologias existem na tabela: ${Object.keys(perfil.valores_construcao).join(', ')}.\n${padroes.join('\n')}`,
    `\nFatores de conservação (${perfil.ref_fatores_conservacao}): ${fcs}`,
    `\n# Cadastro municipal`,
    `Tipo no cadastro: ${caso.imovel.tipo_cadastro ?? '?'}; área construída ${caso.imovel.area_construida_m2 ?? '?'} m²; terreno ${caso.imovel.area_terreno_m2 ?? '?'} m².`,
    `\n# Laudo: ${laudo?.tipo ?? '?'}, ${laudo?.data ?? '?'}, categoria ${laudo?.categoria ?? '?'}, área útil ${laudo?.area_util_m2 ?? '?'} m², ${laudo?.total_fotos ?? '?'} fotos`,
    ...(laudo?.ambientes ?? []).map((a) => `\n## ${a.numero}. ${a.nome}${a.area_m2 ? ` (área medida: ${a.area_m2} m²)` : ''}\n${a.observacoes.join('\n')}`),
    ...(laudo?.observacoes_gerais.length ? [`\n## Observações gerais\n${laudo.observacoes_gerais.join('\n')}`] : []),
    ...(caso.registro?.descricao_construcao
      ? [`\n# Registro de imóveis (${caso.registro.documentos})\nDescrição da construção na matrícula: ${caso.registro.descricao_construcao}` +
        (caso.registro.averbacoes_construcao.length ? `\nAverbações: ${caso.registro.averbacoes_construcao.join('; ')}` : '\nSem averbação de construção.')]
      : []),
  ].join('\n');
}

const laudoCategoria = (caso: Caso) => caso.laudo?.categoria ?? null;

/** Efeito no IPTU de cada estado de conservação, para o padrão dado. */
function impactoConservacao(caso: Caso, perfil: PerfilMunicipio, tipologia: string, padrao: string, acessorias: BlocoConstrucao[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const estado of Object.keys(perfil.fatores_conservacao)) {
    try {
      const s = simular(caso, perfil, { tipologia, padrao, conservacao: estado, acessorias });
      const d = s.reducao_iptu;
      out[estado] = `${estado}: IPTU ${brl(s.revisado.iptu_anual)}` +
        (d == null ? '' : d >= 0 ? ` (redução de ${brl(d)}/ano)` : ` (AUMENTO de ${brl(-d)}/ano)`);
    } catch { /* padrão sem valor no perfil */ }
  }
  return out;
}

/** Põe o efeito de cada opção na pergunta de conservação; as respostas ficam como estão. */
function comImpacto(confirmacoes: Confirmacao[], impacto: Record<string, string>, perfil: PerfilMunicipio): Confirmacao[] {
  const estados = Object.keys(perfil.fatores_conservacao);
  const chave = (opcao: string) => estados.find((v) => opcao === v || opcao.startsWith(`${v} `) || opcao.startsWith(`${v}(`));
  return confirmacoes.map((c) => c.id !== 'conservacao' ? c : {
    ...c, impacto: c.opcoes.map((o) => impacto[chave(o) ?? '']).filter(Boolean).join('; ') || null,
  });
}

function alertaRisco(impacto: Record<string, string>): string[] {
  const piores = Object.entries(impacto).filter(([, t]) => t.includes('AUMENTO'));
  if (!piores.length) return [];
  return [`Risco: se a vistoria da prefeitura concluir ${piores.map(([e]) => e).join(' ou ')}, o IPTU sobe — ` +
    `${piores.map(([, t]) => t).join('; ')}. O lançamento atual já está abaixo desse cenário.`];
}

/**
 * Refaz os valores da classificação (efeito de cada estado de conservação e alerta
 * de risco) com o que está na tela agora — padrão, blocos e áreas —, sem chamar o modelo.
 */
export function recalcularEfeitos(caso: Caso, perfil: PerfilMunicipio): { confirmacoes: Confirmacao[]; alertas: string[] } {
  const c = caso.classificacao;
  if (!c.tipologia || !c.padrao) throw new Error('escolha tipologia e padrão antes de recalcular');
  const impacto = impactoConservacao(caso, perfil, c.tipologia, c.padrao, c.acessorias ?? []);
  return { confirmacoes: comImpacto(caso.confirmacoes, impacto, perfil), alertas: alertaRisco(impacto) };
}

/** Números dos ambientes do laudo citados num bloco ("2. Garagem; 11. Área de Serviço"), ou pelo nome. */
function ambientesDoBloco(caso: Caso, b: Pick<BlocoConstrucao, 'descricao' | 'ambientes'>) {
  const todos = caso.laudo?.ambientes ?? [];
  const nums = [...(b.ambientes ?? '').matchAll(/(\d+)\./g)].map((m) => Number(m[1]));
  const porNumero = todos.filter((a) => nums.includes(a.numero));
  return porNumero.length ? porNumero : todos.filter((a) => normaliza(a.nome) === normaliza(b.descricao));
}

/** Soma das áreas medidas no laudo dos ambientes do bloco; null se algum não tiver área. */
function areaDosAmbientes(caso: Caso, b: Pick<BlocoConstrucao, 'descricao' | 'ambientes'>): number | null {
  const amb = ambientesDoBloco(caso, b);
  if (!amb.length || amb.some((a) => !a.area_m2)) return null;
  return amb.reduce((t, a) => t + a.area_m2!, 0);
}

/** Área do corpo principal pelo laudo: só se todos os ambientes fora dos blocos tiverem área. */
function areaDoCorpoPrincipal(caso: Caso, blocos: BlocoConstrucao[]): number | null {
  const nosBlocos = new Set(blocos.flatMap((b) => ambientesDoBloco(caso, b).map((a) => a.numero)));
  const resto = (caso.laudo?.ambientes ?? []).filter((a) => !nosBlocos.has(a.numero));
  if (!resto.length || resto.some((a) => !a.area_m2)) return null;
  return resto.reduce((t, a) => t + a.area_m2!, 0);
}

export interface ResultadoClassificacao {
  classificacao: Classificacao;
  confirmacoes: Confirmacao[];
  alertas: string[];
  uso: { entrada: number; saida: number; modelo: string };
}

export async function classificar(caso: Caso, perfil: PerfilMunicipio, client = new Anthropic()): Promise<ResultadoClassificacao> {
  if (!caso.laudo?.ambientes.length) throw new Error('o caso não tem laudo com ambientes para classificar');
  const resp = await client.beta.messages.parse({
    model: MODELO,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'high', format: betaZodOutputFormat(esquema(perfil)) },
    system: SISTEMA,
    messages: [{ role: 'user', content: contexto(caso, perfil) }],
  });
  if (resp.stop_reason === 'refusal') throw new Error(`o modelo recusou a classificação (${resp.stop_details?.category ?? 'sem categoria'})`);
  if (resp.stop_reason === 'max_tokens') throw new Error('resposta cortada por max_tokens');
  const r = resp.parsed_output;
  if (!r) throw new Error('resposta sem JSON válido');

  // área dos blocos: a que o proprietário já digitou; senão, a dos ambientes medidos no laudo
  const acessorias: BlocoConstrucao[] = r.acessorias.map((a) => ({
    ...a,
    area_m2: caso.classificacao.acessorias?.find((b) => normaliza(b.descricao) === normaliza(a.descricao))?.area_m2
      ?? areaDosAmbientes(caso, a) ?? null,
  }));
  const areaPrincipal = caso.classificacao.area_principal_m2 ?? areaDoCorpoPrincipal(caso, acessorias);
  if (areaPrincipal != null && caso.classificacao.area_principal_m2 == null) caso = { ...caso, classificacao: { ...caso.classificacao, area_principal_m2: areaPrincipal } };
  const impacto = impactoConservacao(caso, perfil, r.tipologia, r.padrao, acessorias);
  const campos: Record<string, string> = {
    padrao: 'classificacao.padrao', conservacao: 'classificacao.conservacao', tipologia: 'classificacao.tipologia',
  };
  const confirmacoes: Confirmacao[] = r.confirmacoes.map((c) => ({ ...c, campo: campos[c.id] ?? null, impacto: null, resposta: null }));
  // a conservação sempre é perguntada, mesmo que o modelo não tenha listado
  if (!confirmacoes.some((c) => c.id === 'conservacao')) {
    confirmacoes.unshift({
      id: 'conservacao', campo: 'classificacao.conservacao',
      pergunta: 'Qual o estado de conservação do imóvel, no conjunto?',
      opcoes: Object.keys(perfil.fatores_conservacao), sugestao: r.conservacao,
      justificativa: r.estado.map((e) => `${e.elemento}: ${e.conclusao}`).join(' '),
      impacto: null, resposta: null,
    });
  }

  return {
    classificacao: {
      tipologia: r.tipologia, padrao: r.padrao, conservacao: r.conservacao,
      caracteristicas: r.caracteristicas, estado: r.estado, areas_acessorias: r.areas_acessorias, acessorias,
      area_principal_m2: areaPrincipal ?? null,
      confianca: r.confianca, pontos_fracos: r.pontos_fracos,
    },
    confirmacoes: comImpacto(confirmacoes, impacto, perfil),
    alertas: alertaRisco(impacto),
    uso: { entrada: resp.usage.input_tokens, saida: resp.usage.output_tokens, modelo: resp.model },
  };
}
