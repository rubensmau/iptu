// Escolhe o extrator pelo conteúdo do PDF; sem extrator próprio, lê por IA (se permitido).
import type { Extracao } from '../tipos.js';
import { extrairCarneMogiMirim, reconheceCarneMogiMirim } from './carne-mogi-mirim.js';
import { extrairComIA } from './generico-ia.js';
import { extrairLaudoMsys, reconheceLaudoMsys } from './laudo-msys.js';
import { abrirPdf } from './pdf.js';

const EXTRATORES = [
  { nome: 'laudo MSYS', reconhece: reconheceLaudoMsys, extrai: extrairLaudoMsys },
  { nome: 'carnê IPTU Mogi Mirim', reconhece: reconheceCarneMogiMirim, extrai: extrairCarneMogiMirim },
];

export interface ResultadoExtracao {
  extracao: Extracao | null;
  metodo: 'extrator' | 'ia' | 'nenhum';
  erro?: string;
}

export async function extrairDocumento(dados: Uint8Array, nomeArquivo: string, usarIA = false): Promise<ResultadoExtracao> {
  let pdf;
  try {
    // o pdf.js toma posse do buffer; manda uma cópia para sobrar o original para a IA
    pdf = await abrirPdf(dados.slice());
  } catch (e) {
    return { extracao: null, metodo: 'nenhum', erro: `não consegui ler como PDF (${(e as Error).message})` };
  }
  const ex = EXTRATORES.find((e) => e.reconhece(pdf));
  if (ex) return { extracao: await ex.extrai(pdf), metodo: 'extrator' };
  if (!usarIA) return { extracao: null, metodo: 'nenhum', erro: 'formato sem extrator próprio (habilite a leitura por IA)' };
  return { extracao: await extrairComIA(dados, nomeArquivo), metodo: 'ia' };
}
