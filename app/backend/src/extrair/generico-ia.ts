// Leitura por IA para documentos que nenhum extrator específico reconhece
// (laudo de outro sistema, carnê de outra prefeitura, BCI, matrícula...).
// O PDF vai inteiro para a Claude API; a resposta segue o mesmo formato Extracao.
// Mais lento e pago (~US$ 0,10–0,50 por documento), por isso só como alternativa.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { Extracao, Fonte } from '../tipos.js';
import { numero } from './pdf.js';

const MODELO = 'claude-opus-5-5';

// Campos planos como pares campo/valor: um objeto com dezenas de campos opcionais
// estoura o limite de gramática da saída estruturada.
const TEXTO = [
  'requerente.nome', 'requerente.cpf',
  'imovel.endereco.logradouro', 'imovel.endereco.numero', 'imovel.endereco.bairro',
  'imovel.endereco.municipio', 'imovel.endereco.uf', 'imovel.endereco.cep',
  'imovel.inscricao', 'imovel.codigo_reduzido', 'imovel.tipo_cadastro', 'imovel.zona_pgv',
  'laudo.tipo', 'laudo.categoria', 'laudo.numero_documento', 'laudo.data', 'laudo.cidade_emissao', 'laudo.vistoriador',
] as const;
const NUMERO = [
  'imovel.testada_m', 'imovel.area_terreno_m2', 'imovel.area_construida_m2', 'imovel.area_ideal_m2',
  'lancamento.exercicio', 'lancamento.valor_venal_terreno', 'lancamento.valor_venal_edificacao',
  'lancamento.valor_venal_imovel', 'lancamento.iptu_anual', 'lancamento.lixo_anual', 'lancamento.total_lancado',
  'lancamento.parcelas', 'lancamento.imposto_territorial_mensal', 'lancamento.imposto_predial_mensal',
  'lancamento.lixo_mensal', 'lancamento.lixo_valor_m2', 'laudo.area_util_m2', 'laudo.total_fotos',
] as const;

const ESQUEMA = z.object({
  tipo_documento: z.enum(['laudo', 'carne', 'bci', 'outro']).describe(
    'laudo = vistoria/laudo do imóvel; carne = carnê ou documento de arrecadação do IPTU; bci = ficha/boletim cadastral; outro = qualquer outro'),
  descricao_documento: z.string().describe('ex.: "laudo de vistoria de entrada (sistema X)", "carnê IPTU 2026 de Campinas"'),
  campos: z.array(z.object({
    campo: z.enum([...TEXTO, ...NUMERO]),
    valor: z.string().describe('como no documento; datas em AAAA-MM-DD'),
  })).describe('só os campos que o documento traz; requerente = proprietário/contribuinte'),
  ambientes: z.array(z.object({
    numero: z.number(), nome: z.string(),
    observacoes: z.array(z.string()).describe('texto literal do laudo, um item por elemento'),
  })).describe('só em laudos; vazio nos demais'),
  observacoes_gerais: z.array(z.string()),
  campos_incertos: z.array(z.string()).describe('campos lidos com dúvida (ilegível, ambíguo)'),
});

const INSTRUCOES = `Extraia os dados deste documento para um pedido de revisão de IPTU.
- Copie valores exatamente como estão; números em reais e m² como número (50.490,00 -> 50490).
- Não invente: campo ausente é null. Liste em campos_incertos o que foi lido com dúvida.
- Em laudos, transcreva as observações de cada ambiente literalmente, sem resumir, incluindo defeitos.`;

export async function extrairComIA(dados: Uint8Array, nomeArquivo: string, client = new Anthropic()): Promise<Extracao> {
  const resp = await client.beta.messages.parse({
    model: MODELO,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: betaZodOutputFormat(ESQUEMA) },
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: Buffer.from(dados).toString('base64') } },
        { type: 'text', text: INSTRUCOES },
      ],
    }],
  });
  if (resp.stop_reason === 'refusal') throw new Error('o modelo recusou a leitura do documento');
  if (resp.stop_reason === 'max_tokens') throw new Error('documento longo demais para a leitura por IA (resposta cortada)');
  const r = resp.parsed_output;
  if (!r) throw new Error('leitura por IA sem resultado válido');

  const fonte: Fonte = r.tipo_documento === 'carne' ? 'carne' : r.tipo_documento === 'bci' ? 'bci' : r.tipo_documento === 'laudo' ? 'laudo' : 'usuario';
  const ext: Extracao = {
    fonte, documento: `${r.descricao_documento} (lido por IA)`,
    requerente: {}, endereco: {}, imovel: {}, lancamento: {}, laudo: null, origens: {}, alertas: [],
  };
  const ref = `${nomeArquivo}, leitura por IA`;
  const lidos = new Map<string, string | number>();
  for (const { campo, valor } of r.campos) {
    const v = (NUMERO as readonly string[]).includes(campo) ? numero(valor) : valor.trim();
    if (v == null || v === '') continue;
    lidos.set(campo, v);
    if (!campo.startsWith('laudo.')) ext.origens[campo] = { fonte, ref };
  }
  const grupo = (prefixo: string) => Object.fromEntries(
    [...lidos].filter(([k]) => k.startsWith(prefixo) && !k.slice(prefixo.length).includes('.')).map(([k, v]) => [k.slice(prefixo.length), v]));
  ext.requerente = grupo('requerente.');
  ext.endereco = grupo('imovel.endereco.');
  ext.imovel = grupo('imovel.');
  ext.lancamento = grupo('lancamento.');
  if (r.tipo_documento === 'laudo' || r.ambientes.length) {
    const t = (k: string) => (lidos.get(`laudo.${k}`) as string | undefined) ?? null;
    const nn = (k: string) => (lidos.get(`laudo.${k}`) as number | undefined) ?? null;
    ext.laudo = {
      tipo: t('tipo'), categoria: t('categoria'), sistema: null, numero_documento: t('numero_documento'), id_vistoria: null,
      data: t('data'), cidade_emissao: t('cidade_emissao'),
      vistoriador: t('vistoriador') ? { nome: t('vistoriador'), cpf: null } : null,
      area_util_m2: nn('area_util_m2'), total_fotos: nn('total_fotos'), paginas: null,
      observacoes_gerais: r.observacoes_gerais, ambientes: r.ambientes,
    };
    ext.origens['laudo.ambientes'] = { fonte: 'laudo', ref };
  }
  if (r.tipo_documento === 'outro') ext.alertas.push(`${nomeArquivo}: não parece laudo nem carnê (${r.descricao_documento}).`);
  if (r.campos_incertos.length) ext.alertas.push(`${nomeArquivo}: leitura por IA com dúvida em ${r.campos_incertos.join(', ')} — conferir.`);
  ext.alertas.push(`${nomeArquivo}: lido por IA (formato sem extrator próprio) — conferir os valores.`);
  return ext;
}
