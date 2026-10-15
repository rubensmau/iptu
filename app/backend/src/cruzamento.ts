// Junta o que cada extrator tirou num único Caso, conferindo um documento
// contra o outro. Para dados cadastrais vale o carnê (é o que a prefeitura tem);
// o laudo completa o que falta (CEP, CPF) e traz a descrição do imóvel.
import type { Caso, Extracao, Fonte, Laudo } from './tipos.js';

// palavras que indicam defeito numa observação cujo título diz "em bom estado"
const DEFEITO = /trinca|rachadura|ferrugem|quebrad|bolor|umidade|vazamento|mau estado|podre|faltando|faltante|danificad|queimad|emperrad|espanad|soltando|estufad|infiltra/i;

/** Alertas que valem para qualquer laudo, venha do extrator ou da leitura por IA. */
export function alertasLaudo(laudo: Laudo): string[] {
  const out: string[] = [];
  const itens = laudo.ambientes.flatMap((a) => a.observacoes);
  const contraditorios = itens.filter((o) => /em bom estado/i.test(o.split('Obs:')[0]) && DEFEITO.test(o.split('Obs:')[1] ?? ''));
  if (contraditorios.length) {
    out.push(`Laudo: ${contraditorios.length} de ${itens.length} itens vêm como "em bom estado", mas as observações descrevem defeitos. Citar as observações, não o título do item.`);
  }
  if (/entrada|saída|saida|loca/i.test(`${laudo.tipo ?? ''}`)) {
    out.push('Laudo de vistoria de locação, sem ART nem croqui: serve como relatório fotográfico do estado do imóvel (o pedido não depende dele), mas a área útil não equivale necessariamente à área construída do cadastro.');
  }
  return out;
}

const PRIORIDADE: Fonte[] = ['carne', 'bci', 'laudo', 'usuario'];

/** "Maurício  Costa Porto" ~ "MAURICIO COSTA PORTO" */
export const normaliza = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().replace(/\s+/g, ' ').trim();

export function casoVazio(municipio: string): Caso {
  return {
    municipio,
    requerente: { nome: null, cpf: null, telefone: null, email: null, qualidade: null },
    imovel: {
      endereco: { logradouro: null, numero: null, bairro: null, municipio: null, uf: null, cep: null },
      inscricao: null, codigo_reduzido: null, tipo_cadastro: null, zona_pgv: null, testada_m: null,
      area_terreno_m2: null, area_construida_m2: null, area_ideal_m2: null,
    },
    lancamento: {
      exercicio: null, valor_venal_terreno: null, valor_venal_edificacao: null, valor_venal_imovel: null,
      iptu_anual: null, lixo_anual: null, total_lancado: null, parcelas: null,
      imposto_territorial_mensal: null, imposto_predial_mensal: null, lixo_mensal: null, lixo_valor_m2: null,
    },
    laudo: null,
    classificacao: {
      tipologia: null, padrao: null, conservacao: null, caracteristicas: [], estado: [],
      areas_acessorias: null, acessorias: [], confianca: null, pontos_fracos: [],
    },
    anexos: [],
    confirmacoes: [],
    origens: {},
    alertas: [],
  };
}

export function montarCaso(municipio: string, extracoes: Extracao[]): Caso {
  const caso = casoVazio(municipio);
  const ordem = [...extracoes].sort((a, b) => PRIORIDADE.indexOf(a.fonte) - PRIORIDADE.indexOf(b.fonte));

  // preenche cada grupo campo a campo; o primeiro na ordem de prioridade ganha
  const grupos = [
    ['requerente', caso.requerente, (e: Extracao) => e.requerente],
    ['imovel.endereco', caso.imovel.endereco, (e: Extracao) => e.endereco],
    ['imovel', caso.imovel, (e: Extracao) => e.imovel],
    ['lancamento', caso.lancamento, (e: Extracao) => e.lancamento],
  ] as const;
  for (const [prefixo, alvo, pega] of grupos) {
    const destino = alvo as unknown as Record<string, unknown>;
    for (const ext of ordem) {
      for (const [campo, valor] of Object.entries(pega(ext))) {
        if (valor == null || typeof valor === 'object') continue;
        const chave = `${prefixo}.${campo}`;
        const atual = destino[campo];
        if (atual == null) {
          destino[campo] = valor;
          if (ext.origens[chave]) caso.origens[chave] = ext.origens[chave];
        } else if (normaliza(String(atual)) === normaliza(String(valor))) {
          // mesmo valor; prefere a grafia com acentos à do carnê, toda em maiúsculas
          if (typeof valor === 'string' && atual === String(atual).toUpperCase() && valor !== valor.toUpperCase()) {
            destino[campo] = valor;
          }
        } else {
          const o = caso.origens[chave];
          caso.origens[chave] = { ...o, fonte: o?.fonte ?? 'usuario', valor_original: `${o?.valor_original ?? atual}; ${ext.documento}: ${valor}` };
          caso.alertas.push(`${chave}: "${atual}" (${o?.fonte}) diverge de "${valor}" (${ext.documento}). Usado o primeiro.`);
        }
      }
    }
  }

  const laudo = ordem.find((e) => e.laudo)?.laudo ?? null;
  caso.laudo = laudo;
  const cep = caso.imovel.endereco.cep?.replace(/\D/g, '');
  if (cep?.length === 8) caso.imovel.endereco.cep = `${cep.slice(0, 5)}-${cep.slice(5)}`;
  caso.requerente.qualidade ??= caso.requerente.nome ? 'proprietário' : null;
  for (const ext of ordem) {
    for (const [k, o] of Object.entries(ext.origens)) if (k.startsWith('laudo.')) caso.origens[k] ??= o;
    caso.alertas.push(...ext.alertas);
  }
  if (laudo) caso.alertas.push(...alertasLaudo(laudo));
  if (laudo?.categoria) {
    caso.classificacao.tipologia = caso.imovel.tipo_cadastro ?? laudo.categoria;
    caso.origens['classificacao.tipologia'] = { fonte: 'julgamento', ref: `cadastro: ${caso.imovel.tipo_cadastro ?? '?'}; laudo: ${laudo.categoria}` };
  }

  // área útil (laudo) × área construída (cadastro)
  const util = laudo?.area_util_m2, construida = caso.imovel.area_construida_m2;
  if (util && construida) {
    const dif = ((util - construida) / construida) * 100;
    caso.alertas.push(`Área: laudo ${util.toFixed(2)} m² (útil) × cadastro ${construida.toFixed(2)} m² (construída), diferença de ${dif.toFixed(1)}%. ` +
      (Math.abs(dif) > 5 ? 'Diferença relevante — vale pedir o croqui cadastral.' : 'Conceitos diferentes; não afirmar erro de metragem.'));
  }
  return caso;
}
