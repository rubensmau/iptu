// Carnê / documento de arrecadação do IPTU de Mogi Mirim (exercício 2026).
// O quadro "IPTU / TSP" tem rótulo em cima e valor embaixo; o texto sai fora de
// ordem, por isso os valores do quadro são lidos pela posição (valorAbaixo).
import type { Extracao } from '../tipos.js';
import { abrirPdf, numero, valorAbaixo, type Pdf } from './pdf.js';

/** Diz se o PDF parece ser este carnê. */
export const reconheceCarneMogiMirim = (pdf: Pdf) =>
  /MUNIC[IÍ]PIO DE MOGI MIRIM/.test(pdf.texto[0]) && /IPTU \/ TSP/.test(pdf.texto[0]);

// rótulo no carnê -> campo
const QUADRO = {
  imovel: {
    area_terreno_m2: 'Área do Terreno',
    area_construida_m2: 'Área da Construção',
    area_ideal_m2: 'Área Ideal - M²',
    testada_m: 'Testada',
  },
  lancamento: {
    valor_venal_terreno: 'Valor Venal Terreno - R$',
    valor_venal_edificacao: 'Valor Venal Edificação - R$',
    valor_venal_imovel: 'Valor Venal Imóvel - R$',
    iptu_anual: 'Valor IPTU - Anual - R$',
    lixo_anual: 'Coleta Lixo Anual - R$',
    total_lancado: 'Total Lançado - R$',
    parcelas: 'Quantidade de Parcelas',
    imposto_territorial_mensal: 'Valor Imposto Territorial Mensal - R$',
    imposto_predial_mensal: 'Valor Imposto Predial Mensal - R$',
    lixo_mensal: 'Valor Coleta Lixo Mensal - R$',
    lixo_valor_m2: 'Valor M2 Lixo - R$',
  },
} as const;

export async function extrairCarneMogiMirim(dados: Uint8Array | Pdf): Promise<Extracao> {
  const pdf = 'texto' in dados ? dados : await abrirPdf(dados);
  const texto = pdf.texto[0];
  const itens = await pdf.itens(1);
  const ext: Extracao = {
    fonte: 'carne', documento: 'carnê IPTU Mogi Mirim',
    requerente: {}, endereco: {}, imovel: {}, lancamento: {}, laudo: null, origens: {}, alertas: [],
  };
  const origem = (campo: string, ref: string, valor_original?: string) => {
    ext.origens[campo] = { fonte: 'carne', ref, ...(valor_original ? { valor_original } : {}) };
  };

  for (const [campo, rotulo] of Object.entries(QUADRO.imovel)) {
    const v = numero(valorAbaixo(itens, rotulo));
    if (v != null) { ext.imovel[campo as keyof typeof QUADRO.imovel] = v; origem(`imovel.${campo}`, rotulo); }
  }
  for (const [campo, rotulo] of Object.entries(QUADRO.lancamento)) {
    const v = numero(valorAbaixo(itens, rotulo));
    if (v != null) { ext.lancamento[campo as keyof typeof QUADRO.lancamento] = v; origem(`lancamento.${campo}`, rotulo); }
  }
  const zona = valorAbaixo(itens, 'Zona / PGV');
  if (zona) { ext.imovel.zona_pgv = zona; origem('imovel.zona_pgv', 'Zona / PGV'); }
  const tipo = valorAbaixo(itens, 'Prédio / Tipo');
  if (tipo) { ext.imovel.tipo_cadastro = tipo; origem('imovel.tipo_cadastro', 'Prédio / Tipo'); }

  // Ref:IPTU Imovel/Inscrição:81-38-25-0102-001/Código:40065-2026-1
  const ref = texto.match(/Inscri[çc][ãa]o:\s*([\d-]+)\/C[óo]digo:\s*(\d+)-(\d{4})/);
  if (ref) {
    ext.imovel.inscricao = ref[1]; origem('imovel.inscricao', 'Ref: Inscrição');
    ext.imovel.codigo_reduzido = ref[2]; origem('imovel.codigo_reduzido', 'Ref: Código');
    ext.lancamento.exercicio = Number(ref[3]); origem('lancamento.exercicio', 'Ref: Código');
  }

  // Bloco "Principal": nome, endereço e CPF/CNPJ, uma linha cada
  const principal = texto.match(/Principal\n(.+)\n(.+)\n([\d./-]{14,18})\n/);
  if (principal) {
    ext.requerente.nome = principal[1].trim(); origem('requerente.nome', 'Proprietário/Contribuinte');
    ext.requerente.cpf = principal[3]; origem('requerente.cpf', 'Documento');
    const end = principal[2].trim().match(/^(.*?)\s+(\d+[A-Z]?)\s+(.*)$/);
    if (end) {
      ext.endereco.logradouro = end[1]; ext.endereco.numero = end[2]; ext.endereco.bairro = end[3];
      for (const c of ['logradouro', 'numero', 'bairro']) origem(`imovel.endereco.${c}`, 'Localização', principal[2].trim());
    } else {
      ext.endereco.logradouro = principal[2].trim(); origem('imovel.endereco.logradouro', 'Localização');
      ext.alertas.push(`Carnê: não consegui separar número e bairro de "${principal[2].trim()}".`);
    }
  }
  ext.endereco.municipio = 'Mogi Mirim'; ext.endereco.uf = 'SP';
  origem('imovel.endereco.municipio', 'cabeçalho'); origem('imovel.endereco.uf', 'cabeçalho');

  const faltam = [...Object.values(QUADRO.imovel), ...Object.values(QUADRO.lancamento)]
    .filter((r) => !itens.some((i) => i.str === r));
  if (faltam.length) ext.alertas.push(`Carnê: rótulos não encontrados: ${faltam.join(', ')}.`);
  return ext;
}
