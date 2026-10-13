import { getDocumentProxy } from 'unpdf';

export interface ItemTexto {
  str: string;
  x: number; // canto inferior esquerdo, em pontos
  y: number;
  largura: number;
}

export interface Pdf {
  paginas: number;
  texto: string[]; // uma string por página, linhas separadas por \n
  itens: (pagina: number) => Promise<ItemTexto[]>; // pagina começa em 1
}

/** Abre o PDF e devolve o texto de cada página. NBSP vira espaço (o MSYS usa nos números de item). */
export async function abrirPdf(dados: Uint8Array): Promise<Pdf> {
  const doc = await getDocumentProxy(dados);
  const texto: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const conteudo = await (await doc.getPage(p)).getTextContent();
    let pagina = '';
    for (const it of conteudo.items) {
      if (!('str' in it)) continue;
      pagina += it.str + (it.hasEOL ? '\n' : '');
    }
    texto.push(pagina.replace(/ /g, ' '));
  }
  return {
    paginas: doc.numPages,
    texto,
    itens: async (pagina) => {
      const conteudo = await (await doc.getPage(pagina)).getTextContent();
      return conteudo.items.flatMap((it) =>
        'str' in it && it.str.trim()
          ? [{ str: it.str.trim(), x: it.transform[4], y: it.transform[5], largura: it.width }]
          : []);
    },
  };
}

/**
 * Valor impresso logo abaixo de um rótulo (layout de carnê: rótulo em cima, valor embaixo).
 * Não confia na ordem do texto — no carnê de Mogi Mirim vários valores vêm antes do rótulo.
 */
export function valorAbaixo(itens: ItemTexto[], rotulo: string, distanciaMax = 16): string | null {
  const r = itens.find((i) => i.str === rotulo);
  if (!r) return null;
  const centro = r.x + r.largura / 2;
  const candidatos = itens
    .filter((i) => i !== r && i.y < r.y && r.y - i.y <= distanciaMax)
    .filter((i) => i.x <= centro && centro <= i.x + i.largura + 4 || Math.abs(i.x + i.largura / 2 - centro) < r.largura / 2)
    .sort((a, b) => b.y - a.y);
  return candidatos[0]?.str ?? null;
}

/** "50.490,00" -> 50490; "126.06" (ponto decimal, como no MSYS) -> 126.06. */
export function numero(s: string | null | undefined): number | null {
  if (!s) return null;
  const limpo = s.replace(/[^\d.,-]/g, '');
  if (!limpo) return null;
  const n = limpo.includes(',') ? Number(limpo.replace(/\./g, '').replace(',', '.')) : Number(limpo);
  return Number.isFinite(n) ? n : null;
}
