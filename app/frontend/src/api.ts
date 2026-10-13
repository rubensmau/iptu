import type { Caso, Confirmacao, Classificacao, Extracao } from '../../backend/src/tipos'
import type { Simulacao } from '../../backend/src/calc'

export type { Caso, Confirmacao, Classificacao, Extracao, Simulacao }

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

export type Municipio = {
  id: string; nome: string; uf: string; exercicio: number; pendencias: string[]
  padroes: Record<string, string[]>; conservacao: string[]
}
export type ResultadoExtracao = { extracao: Extracao | null; metodo: 'extrator' | 'ia' | 'nenhum'; erro?: string }
export type ResultadoClassificacao = {
  classificacao: Classificacao
  confirmacoes: Confirmacao[]
  alertas: string[]
  uso: { entrada: number; saida: number; modelo: string }
}
export type Trabalho = { status: 'rodando' | 'pronto' | 'erro'; resultado?: ResultadoClassificacao; erro?: string; segundos: number }
export type RespostaSimulacao = {
  simulacao: Simulacao | null
  cenarios: Simulacao[]
  implicito: { efetivo: number; padroes: { tipologia: string; padrao: string; valor_m2: number; fc_implicito: number }[] } | null
}

async function pede<T>(caminho: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}/api${caminho}`, init)
  const corpo = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(corpo.error ?? `erro ${r.status}`)
  return corpo as T
}
const json = (corpo: unknown): RequestInit => ({
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
})

export const api = {
  municipios: () => pede<{ municipios: Municipio[]; ia_disponivel: boolean }>('/municipios'),
  documento: (arquivo: File, ia: boolean) =>
    pede<ResultadoExtracao>(`/documentos${ia ? '?ia=1' : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf', 'X-Nome-Arquivo': encodeURIComponent(arquivo.name) },
      body: arquivo,
    }),
  caso: (extracoes: Extracao[], municipio?: string) => pede<{ caso: Caso }>('/caso', json({ extracoes, municipio })),
  simular: (caso: Caso) => pede<RespostaSimulacao>('/simular', json({ caso })),
  classificar: (caso: Caso) => pede<{ id: string }>('/classificacoes', json({ caso })),
  trabalho: (id: string) => pede<Trabalho>(`/classificacoes/${id}`),
}

export const brl = (x: number | null | undefined) =>
  x == null ? '—' : x.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const num = (x: number | null | undefined, casas = 2) =>
  x == null ? '—' : x.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
