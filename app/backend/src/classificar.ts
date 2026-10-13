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
import type { Caso, Classificacao, Confirmacao, PerfilMunicipio } from './tipos.js';

const MODELO = 'claude-opus-5-5';

const SISTEMA = `Você ajuda proprietários de imóveis a pedir revisão do IPTU à prefeitura.
Recebe o perfil legal do município (tabela de padrões construtivos, fatores de conservação, critérios da lei)
e o laudo de vistoria do imóvel, e sugere o enquadramento que a prefeitura deveria aplicar.

Regras:
- Baseie-se apenas no texto do laudo. Cite as evidências com o número e o nome do ambiente (ex.: "11. Área de Serviço").
- Laudos de vistoria de locação costumam marcar todo item como "em bom estado" por padrão do sistema;
  o que vale são as observações. Mesmo assim, aponte esse título como ponto fraco do pedido.
- Considere a predominância dos elementos no conjunto do imóvel, não o pior item isolado.
- Seja honesto: se as evidências apoiam um estado melhor que o pedido, diga. O proprietário vai decidir.
- Só use padrões e estados que existem no perfil. Se o imóvel não se encaixa em nenhum padrão disponível, diga isso na justificativa.
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
  const padroes = Object.entries(perfil.valores_construcao).flatMap(([tipo, ps]) =>
    Object.entries(ps).map(([p, v]) => `  - ${tipo} ${p}: ${v.valor_m2 != null ? brl(v.valor_m2) + '/m²' : 'valor não levantado'}. ${v.descricao ?? ''}`));
  const fcs = Object.entries(perfil.fatores_conservacao).map(([e, f]) => `${e} = ${f.toFixed(2)}`).join('; ');
  const laudo = caso.laudo;
  return [
    `# Município: ${perfil.nome}/${perfil.uf}, exercício ${perfil.exercicio}`,
    normas,
    `\nPadrões construtivos disponíveis no perfil (os demais ainda não foram levantados):\n${padroes.join('\n')}`,
    `\nFatores de conservação (${perfil.ref_fatores_conservacao}): ${fcs}`,
    `\n# Cadastro municipal`,
    `Tipo no cadastro: ${caso.imovel.tipo_cadastro ?? '?'}; área construída ${caso.imovel.area_construida_m2 ?? '?'} m²; terreno ${caso.imovel.area_terreno_m2 ?? '?'} m².`,
    `\n# Laudo: ${laudo?.tipo ?? '?'}, ${laudo?.data ?? '?'}, categoria ${laudo?.categoria ?? '?'}, área útil ${laudo?.area_util_m2 ?? '?'} m², ${laudo?.total_fotos ?? '?'} fotos`,
    ...(laudo?.ambientes ?? []).map((a) => `\n## ${a.numero}. ${a.nome}\n${a.observacoes.join('\n')}`),
    ...(laudo?.observacoes_gerais.length ? [`\n## Observações gerais\n${laudo.observacoes_gerais.join('\n')}`] : []),
  ].join('\n');
}

/** Efeito no IPTU de cada estado de conservação, para o padrão sugerido. */
function impactoConservacao(caso: Caso, perfil: PerfilMunicipio, tipologia: string, padrao: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const estado of Object.keys(perfil.fatores_conservacao)) {
    try {
      const s = simular(caso, perfil, { tipologia, padrao, conservacao: estado });
      const d = s.reducao_iptu;
      out[estado] = `${estado}: IPTU ${brl(s.revisado.iptu_anual)}` +
        (d == null ? '' : d >= 0 ? ` (redução de ${brl(d)}/ano)` : ` (AUMENTO de ${brl(-d)}/ano)`);
    } catch { /* padrão sem valor no perfil */ }
  }
  return out;
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

  const impacto = impactoConservacao(caso, perfil, r.tipologia, r.padrao);
  const chave = (opcao: string, validas: string[]) =>
    validas.find((v) => opcao === v || opcao.startsWith(`${v} `) || opcao.startsWith(`${v}(`)) ?? null;
  const estados = Object.keys(perfil.fatores_conservacao);
  const campos: Record<string, string> = {
    padrao: 'classificacao.padrao', conservacao: 'classificacao.conservacao', tipologia: 'classificacao.tipologia',
  };
  const confirmacoes: Confirmacao[] = r.confirmacoes.map((c) => ({
    ...c,
    campo: campos[c.id] ?? null,
    impacto: c.id === 'conservacao'
      ? c.opcoes.map((o) => impacto[chave(o, estados) ?? '']).filter(Boolean).join('; ') || null
      : null,
    resposta: null,
  }));
  // a conservação sempre é perguntada, mesmo que o modelo não tenha listado
  if (!confirmacoes.some((c) => c.id === 'conservacao')) {
    confirmacoes.unshift({
      id: 'conservacao', campo: 'classificacao.conservacao',
      pergunta: 'Qual o estado de conservação do imóvel, no conjunto?',
      opcoes: Object.keys(perfil.fatores_conservacao), sugestao: r.conservacao,
      justificativa: r.estado.map((e) => `${e.elemento}: ${e.conclusao}`).join(' '),
      impacto: Object.values(impacto).join('; ') || null, resposta: null,
    });
  }

  const alertas: string[] = [];
  const piores = Object.entries(impacto).filter(([, t]) => t.includes('AUMENTO'));
  if (piores.length) {
    alertas.push(`Risco: se a vistoria da prefeitura concluir ${piores.map(([e]) => e).join(' ou ')}, o IPTU sobe — ` +
      `${piores.map(([, t]) => t).join('; ')}. O lançamento atual já está abaixo desse cenário.`);
  }

  return {
    classificacao: {
      tipologia: r.tipologia, padrao: r.padrao, conservacao: r.conservacao,
      caracteristicas: r.caracteristicas, estado: r.estado, areas_acessorias: r.areas_acessorias,
      confianca: r.confianca, pontos_fracos: r.pontos_fracos,
    },
    confirmacoes,
    alertas,
    uso: { entrada: resp.usage.input_tokens, saida: resp.usage.output_tokens, modelo: resp.model },
  };
}
