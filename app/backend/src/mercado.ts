// Valor venal lançado × valor de mercado. Quando há escritura com o preço da última
// compra, corrige o preço pelo IPCA até dezembro do ano anterior ao exercício (a data
// de referência do lançamento) e compara com o valor venal total.
//
// A base do IPTU é o valor venal (CTN, art. 33), que não deve passar do valor de
// mercado; para o ITBI, o STJ (Tema 1.113) deu presunção de veracidade ao valor da
// transação. O argumento vale em qualquer município, por isso não fica no perfil.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Caso } from './tipos.js';

const ARQUIVO = resolve(import.meta.dirname, '../../../indices/ipca.json');

function ipca(): Record<string, number> {
  try { return (JSON.parse(readFileSync(ARQUIVO, 'utf-8')) as { mensal: Record<string, number> }).mensal; } catch { return {}; }
}

export interface ComparacaoMercado {
  data_compra: string;      // AAAA-MM-DD
  preco: number;
  valor_referencia: number | null;
  mes_de: string;           // AAAA-MM
  mes_ate: string;
  fator: number;
  preco_corrigido: number;
  valor_venal: number;
  excesso: number;          // fração: 0.20 = valor venal 20% acima do preço corrigido
}

/** Comparação do preço pago (corrigido) com o valor venal lançado; null se faltar dado. */
export function comparaMercado(caso: Caso, exercicioPadrao?: number): ComparacaoMercado | null {
  const t = caso.registro?.transacao, vvi = caso.lancamento.valor_venal_imovel;
  if (!t?.valor || !t.data || !vvi) return null;
  const serie = ipca();
  const meses = Object.keys(serie).sort();
  if (!meses.length) return null;
  const ex = caso.lancamento.exercicio ?? exercicioPadrao ?? Number(meses.at(-1)!.slice(0, 4)) + 1;
  const mesDe = t.data.slice(0, 7);
  const alvo = `${ex - 1}-12`;
  const mesAte = alvo <= meses.at(-1)! ? alvo : meses.at(-1)!;
  if (!serie[mesDe] || mesDe > mesAte) return null;
  const fator = serie[mesAte] / serie[mesDe];
  const corrigido = Math.round(t.valor * fator * 100) / 100;
  return {
    data_compra: t.data, preco: t.valor, valor_referencia: t.valor_referencia ?? null,
    mes_de: mesDe, mes_ate: mesAte, fator, preco_corrigido: corrigido,
    valor_venal: vvi, excesso: vvi / corrigido - 1,
  };
}

export const mesAno = (m: string) => `${m.slice(5)}/${m.slice(0, 4)}`;
