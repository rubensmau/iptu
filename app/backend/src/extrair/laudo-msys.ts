// Laudo de vistoria gerado pelo sistema MSYS (msysvistorias.com.br).
// Página 1: cabeçalho (endereço, partes, data, área útil, link); depois as seções
// "N. Ambiente" com itens "N.M - <título> em <estado>. Obs: <texto>", intercaladas
// com legendas das fotos ("Registro geral"); última página: assinaturas com CPF.
import type { Ambiente, Extracao, Laudo } from '../tipos.js';
import { abrirPdf, numero, type Pdf } from './pdf.js';

export const reconheceLaudoMsys = (pdf: Pdf) =>
  /Laudo de Vistoria de /.test(pdf.texto[0]) && /msysvistorias\.com\.br/.test(pdf.texto[0]);

const LEGENDA = /^(?:(?:Registro geral|Registro|Outros)\s*)+$/;
const RODAPE = /^(Esta página é parte integrante|Locatários: |Proprietário: )|^(?:S_)?\d{11}(?:_S)?(?:\s+(?:S_)?\d{11}(?:_S)?)*$/;
const QUEBRA = '\u0000'; // marca o lugar de um bloco de fotos

export async function extrairLaudoMsys(dados: Uint8Array | Pdf): Promise<Extracao> {
  const pdf = 'texto' in dados ? dados : await abrirPdf(dados);
  const p1 = pdf.texto[0];
  const ext: Extracao = {
    fonte: 'laudo', documento: 'laudo MSYS',
    requerente: {}, endereco: {}, imovel: {}, lancamento: {}, laudo: null, origens: {}, alertas: [],
  };
  const origem = (campo: string, ref: string, valor_original?: string) => {
    ext.origens[campo] = { fonte: 'laudo', ref, ...(valor_original ? { valor_original } : {}) };
  };

  const titulo = p1.match(/Laudo de (Vistoria de \S+) (\d+)/);
  const link = p1.match(/openview\.html\?([A-Za-z0-9+/=]+)/);
  const idVistoria = link ? Buffer.from(link[1], 'base64').toString('latin1').match(/idtInspection=(\d+)/)?.[1] ?? null : null;
  const data = p1.match(/(\d{2})\/(\d{2})\/(\d{4})[\d: ]*Data do laudo/);
  const area = p1.match(/Área útil\s*Área total\s*([\d.,]+)\s+([\d.,]+)/);
  const categoria = p1.match(/Tipo de locação\n(.+)\n(.+)\n/);
  const ultima = pdf.texto[pdf.paginas - 1];
  const cidade = pdf.texto.join('\n').match(/Considerações finais\n([^\n,]+), \d{1,2} de \S+ de \d{4}/);

  const laudo: Laudo = {
    tipo: titulo ? `${titulo[1]} (locação${categoria?.[2] ? ` ${categoria[2].toLowerCase()}` : ''})` : null,
    categoria: categoria?.[1].trim() ?? null,
    sistema: 'MSYS',
    numero_documento: titulo?.[2] ?? null,
    id_vistoria: idVistoria,
    data: data ? `${data[3]}-${data[2]}-${data[1]}` : null,
    cidade_emissao: cidade?.[1].trim() ?? null,
    vistoriador: null,
    area_util_m2: numero(area?.[1]) || null, // o MSYS imprime 0.0 quando não informado
    total_fotos: numero(p1.match(/Total de fotos\s*(\d+)/)?.[1]),
    paginas: pdf.paginas,
    observacoes_gerais: [],
    ambientes: [],
  };
  origem('laudo.numero_documento', 'título p.1');
  if (idVistoria) origem('laudo.id_vistoria', 'link p.1 (base64 idtInspection)');
  if (laudo.area_util_m2) origem('laudo.area_util_m2', 'p.1, Área útil');

  // Endereço do imóvel 812 - Rua Hermínio Cecato, 64, Martim Francisco, Mogi Mirim - SP - Cep: 13817075.
  const end = p1.match(/Endereço do imóvel \S+ - (.+?), (\d+\w?), (.+?), (.+?) - ([A-Z]{2}) - Cep: (\d{5})-?(\d{3})/);
  if (end) {
    Object.assign(ext.endereco, {
      logradouro: end[1], numero: end[2], bairro: end[3], municipio: end[4], uf: end[5], cep: `${end[6]}-${end[7]}`,
    });
    for (const c of ['logradouro', 'numero', 'bairro', 'municipio', 'uf', 'cep']) origem(`imovel.endereco.${c}`, 'p.1');
  } else {
    ext.alertas.push('Laudo: endereço do imóvel não reconhecido na p.1.');
  }

  // assinaturas: nome / CPF/MF N.º ... / papel
  const assinaturas = [...ultima.matchAll(/([^\n]+)\nCPF\/MF N\.º ([\d.-]+)\n(Proprietário|Locatário|Vistoriador)/g)];
  const proprietarios = assinaturas.filter((a) => a[3] === 'Proprietário');
  const vist = assinaturas.find((a) => a[3] === 'Vistoriador');
  if (vist) laudo.vistoriador = { nome: vist[1].trim(), cpf: vist[2] };
  const prop = proprietarios[0];
  const nomeP1 = p1.match(/\n(.+?)Proprietário\(a\)/)?.[1].trim();
  if (prop) {
    ext.requerente = { nome: prop[1].trim(), cpf: prop[2], qualidade: 'proprietário' };
    origem('requerente.nome', `p.${pdf.paginas}, assinaturas`); origem('requerente.cpf', `p.${pdf.paginas}, assinaturas`);
    origem('requerente.qualidade', 'Proprietário(a)');
  } else if (nomeP1) {
    ext.requerente = { nome: nomeP1, qualidade: 'proprietário' };
    origem('requerente.nome', 'p.1'); origem('requerente.qualidade', 'Proprietário(a)');
  }
  if (proprietarios.length > 1) {
    ext.alertas.push(`Laudo: ${proprietarios.length} proprietários (${proprietarios.map((p) => p[1].trim()).join(', ')}); usado o primeiro como requerente.`);
  }

  // ---- ambientes
  const linhas: string[] = [];
  for (const pagina of pdf.texto) {
    for (const bruta of pagina.split('\n')) {
      const l = bruta.trim();
      if (!l || RODAPE.test(l)) continue;
      if (LEGENDA.test(l)) { if (linhas.at(-1) !== QUEBRA) linhas.push(QUEBRA); continue; }
      linhas.push(l);
    }
  }
  const ini = linhas.findIndex((l) => /^1\. \S/.test(l));
  const fim = linhas.findIndex((l) => /^\d+\. Considerações finais/.test(l));
  let atual: Ambiente | null = null;
  let item: string[] | null = null; // linhas do item em curso
  let solto: string[] = [];          // texto depois de um bloco de fotos, fora de item
  const fechaItem = () => { if (atual && item) atual.observacoes.push(item.join(' ')); item = null; };
  const fechaSolto = () => { if (solto.length) laudo.observacoes_gerais.push(solto.join(' ')); solto = []; };
  for (const l of linhas.slice(ini, fim < 0 ? undefined : fim)) {
    const sec = l.match(/^(\d+)\. (\S.*)$/);
    const it = /^\d+\.\d+ - /.test(l);
    if (l === QUEBRA) { fechaItem(); fechaSolto(); continue; }
    if (sec && !it) {
      fechaItem(); fechaSolto();
      // área medida, quando o laudo a põe no título: "2. Garagem (20 m2)"
      const area = sec[2].match(/^(.*?)\s*\((\d+(?:[.,]\d+)?)\s*m[²2]\)$/);
      atual = { numero: Number(sec[1]), nome: (area?.[1] ?? sec[2]).trim(), observacoes: [], area_m2: area ? Number(area[2].replace(',', '.')) : null };
      laudo.ambientes.push(atual);
    } else if (it) {
      fechaItem(); fechaSolto(); item = [l];
    } else if (item) {
      item.push(l);
    } else {
      solto.push(l);
    }
  }
  fechaItem(); fechaSolto();
  if (laudo.ambientes.length) origem('laudo.ambientes', `seções 1 a ${laudo.ambientes.length}`);
  const medidos = laudo.ambientes.filter((a) => a.area_m2);
  if (medidos.length) origem('laudo.ambientes.area_m2', `títulos de ${medidos.map((a) => `${a.numero}. ${a.nome}`).join(', ')}`);
  else ext.alertas.push('Laudo: nenhum ambiente reconhecido.');

  // ---- alertas
  if (laudo.numero_documento && laudo.id_vistoria && laudo.numero_documento !== laudo.id_vistoria) {
    ext.alertas.push(`Laudo: o título diz nº ${laudo.numero_documento} (código do imóvel); o id da vistoria no link é ${laudo.id_vistoria}. Citar os dois.`);
  }
  ext.laudo = laudo;
  return ext;
}
