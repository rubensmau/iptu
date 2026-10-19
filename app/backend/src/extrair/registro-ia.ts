// Leitura por IA da matrícula do Registro de Imóveis e/ou da escritura. Costumam
// vir digitalizados (foto ou scanner, sem texto), então não há extrator próprio:
// o PDF vai inteiro para a Claude API, que lê as imagens.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { Extracao, Registro } from '../tipos.js';

const MODELO = 'claude-opus-5-5';

const ESQUEMA = z.object({
  documentos: z.string().describe('o que o PDF contém, ex.: "certidão da matrícula nº 2.004 do CRI de Mogi Mirim e escritura de venda e compra de 27/07/2022"'),
  e_registro: z.boolean().describe('false se o PDF não for matrícula, certidão de registro de imóvel nem escritura'),
  matricula: z.string().nullable(),
  cartorio: z.string().nullable().describe('cartório de registro de imóveis da matrícula'),
  proprietarios: z.array(z.object({ nome: z.string(), cpf: z.string().nullable() }))
    .describe('titulares ATUAIS: os adquirentes do último ato de transmissão (R.), não os anteriores'),
  inscricao_cadastral: z.string().nullable().describe('número do cadastro municipal citado ("CADASTRADO sob nº ...")'),
  logradouro: z.string().nullable(), numero: z.string().nullable(), bairro: z.string().nullable(),
  municipio: z.string().nullable(), uf: z.string().nullable(),
  area_terreno_m2: z.number().nullable().describe('em m²'),
  medidas_terreno: z.string().nullable().describe('frente, fundos e laterais como no texto'),
  descricao_construcao: z.string().nullable().describe('transcrição literal da descrição da construção (material, cômodos, forro, piso...)'),
  area_construida_m2: z.number().nullable().describe('em m²; só se o registro ou uma averbação der a área construída em m²'),
  averbacoes_construcao: z.array(z.string()).describe('resumo de cada averbação de construção, ampliação ou demolição; vazio se não houver'),
  data_transacao: z.string().nullable().describe('data da escritura da última transmissão, AAAA-MM-DD'),
  valor_transacao: z.number().nullable().describe('preço da última transmissão, em reais (115.000,00 -> 115000)'),
  valor_venal_declarado: z.number().nullable().describe('valor venal citado na escritura, em reais'),
  valor_referencia: z.number().nullable().describe('valor de referência (ITBI) citado na escritura, em reais'),
  campos_incertos: z.array(z.string()).describe('campos lidos com dúvida (ilegível, ambíguo)'),
});

const INSTRUCOES = `Este PDF deve ser a matrícula de um imóvel e/ou a escritura da última compra.
Extraia os dados para conferir um pedido de revisão de IPTU.
- Copie valores como estão no documento; não invente: o que não constar é null.
- Os titulares atuais são os adquirentes do último registro de transmissão (venda, doação, partilha).
- Transcreva literalmente a descrição da construção: ela será comparada com a classificação do imóvel.
- Liste em campos_incertos o que foi lido com dúvida.`;

export async function extrairRegistroComIA(dados: Uint8Array, nomeArquivo: string, client = new Anthropic()): Promise<Extracao> {
  const resp = await client.beta.messages.parse({
    model: MODELO,
    max_tokens: 8000,
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

  const transacao = r.data_transacao || r.valor_transacao || r.valor_venal_declarado || r.valor_referencia
    ? { data: r.data_transacao, valor: r.valor_transacao, valor_venal_declarado: r.valor_venal_declarado, valor_referencia: r.valor_referencia }
    : null;
  const registro: Registro = {
    documentos: r.documentos, matricula: r.matricula, cartorio: r.cartorio,
    proprietarios: r.proprietarios.map((p) => ({ nome: p.nome, cpf: p.cpf })),
    inscricao_cadastral: r.inscricao_cadastral,
    endereco: { logradouro: r.logradouro, numero: r.numero, bairro: r.bairro, municipio: r.municipio, uf: r.uf },
    area_terreno_m2: r.area_terreno_m2, medidas_terreno: r.medidas_terreno,
    descricao_construcao: r.descricao_construcao, area_construida_m2: r.area_construida_m2,
    averbacoes_construcao: r.averbacoes_construcao, transacao,
  };
  const alertas: string[] = [];
  if (!r.e_registro) alertas.push(`${nomeArquivo}: não parece matrícula nem escritura (${r.documentos}).`);
  if (r.campos_incertos.length) alertas.push(`${nomeArquivo}: leitura por IA com dúvida em ${r.campos_incertos.join(', ')} — conferir.`);
  return {
    fonte: 'registro', documento: `${r.documentos} (lido por IA)`,
    requerente: {}, endereco: {}, imovel: {}, lancamento: {}, laudo: null, registro,
    origens: { registro: { fonte: 'registro', ref: `${nomeArquivo}, leitura por IA` } }, alertas,
  };
}
