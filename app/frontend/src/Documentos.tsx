import { useEffect, useState } from 'react'
import { api, type Extracao, type ResultadoExtracao } from './api'

type Linha = { arquivo: File; estado: 'lendo' | 'ok' | 'erro'; resultado?: ResultadoExtracao; erro?: string }

/** Passo 1: o proprietário envia os PDFs que tem; cada um é lido no backend. */
export default function Documentos({ iaDisponivel, aoMontar }: {
  iaDisponivel: boolean
  aoMontar: (extracoes: Extracao[]) => Promise<void>
}) {
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [usarIA, setUsarIA] = useState(iaDisponivel)
  useEffect(() => setUsarIA(iaDisponivel), [iaDisponivel])
  const [montando, setMontando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function adiciona(arquivos: FileList | null) {
    if (!arquivos) return
    const novos = [...arquivos].map((arquivo): Linha => ({ arquivo, estado: 'lendo' }))
    setLinhas((l) => [...l, ...novos])
    await Promise.all(novos.map(async (n) => {
      try {
        const resultado = await api.documento(n.arquivo, usarIA)
        const estado = resultado.extracao ? 'ok' : 'erro'
        setLinhas((l) => l.map((x) => (x === n ? { ...x, estado, resultado, erro: resultado.erro } : x)))
      } catch (e) {
        setLinhas((l) => l.map((x) => (x === n ? { ...x, estado: 'erro', erro: (e as Error).message } : x)))
      }
    }))
  }

  const extracoes = linhas.flatMap((l) => (l.resultado?.extracao ? [l.resultado.extracao] : []))
  const lendo = linhas.some((l) => l.estado === 'lendo')

  async function monta() {
    setMontando(true); setErro(null)
    try { await aoMontar(extracoes) } catch (e) { setErro((e as Error).message) } finally { setMontando(false) }
  }

  return (
    <section className="cartao">
      <h2>1. Documentos</h2>
      <p className="fraco">
        Envie o laudo de vistoria e o carnê (ou documento de arrecadação) do IPTU, em PDF. Outros documentos
        (ficha cadastral, BCI) também ajudam.
      </p>
      <div className="linha">
        <input type="file" accept="application/pdf" multiple onChange={(e) => { adiciona(e.target.files); e.target.value = '' }} />
        <label className={iaDisponivel ? '' : 'fraco'} title="Para formatos sem extrator próprio. Leva ~30 s e custa alguns centavos por documento.">
          <input type="checkbox" checked={usarIA} disabled={!iaDisponivel} onChange={(e) => setUsarIA(e.target.checked)} />
          {' '}ler por IA os formatos desconhecidos{!iaDisponivel && ' (sem chave da API no backend)'}
        </label>
      </div>
      {linhas.length > 0 && (
        <table>
          <thead><tr><th>Arquivo</th><th>Reconhecido como</th><th>Campos</th></tr></thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i}>
                <td className="nome">{l.arquivo.name}</td>
                <td>
                  {l.estado === 'lendo' && <span className="fraco">lendo…</span>}
                  {l.estado === 'ok' && <>{l.resultado!.extracao!.documento} <span className={`tag ${l.resultado!.metodo}`}>{l.resultado!.metodo === 'ia' ? 'IA' : 'extrator'}</span></>}
                  {l.estado === 'erro' && <span className="texto-erro">{l.erro}</span>}
                </td>
                <td className="num">{l.resultado?.extracao ? Object.keys(l.resultado.extracao.origens).length : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {erro && <p className="erro">{erro}</p>}
      <div className="acoes">
        <button className="primario" disabled={!extracoes.length || lendo || montando} onClick={monta}>
          {montando ? 'Montando…' : 'Montar o caso'}
        </button>
        {linhas.length > 0 && <button onClick={() => setLinhas([])} disabled={lendo}>Limpar</button>}
      </div>
    </section>
  )
}
