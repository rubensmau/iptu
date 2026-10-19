import { useEffect, useState } from 'react'
import { api, type Extracao, type ResultadoExtracao } from './api'

type Tipo = 'laudo' | 'carne' | 'registro' | 'outro'
type Linha = { tipo: Tipo; arquivo: File; estado: 'lendo' | 'ok' | 'erro'; inicio: number; fim?: number; resultado?: ResultadoExtracao; erro?: string }

const VAGAS: { tipo: Tipo; titulo: string; dica: string; varios?: boolean }[] = [
  { tipo: 'laudo', titulo: 'Laudo de vistoria', dica: 'o laudo do imóvel, com a descrição dos cômodos e do estado de conservação' },
  { tipo: 'carne', titulo: 'Carnê do IPTU', dica: 'carnê, boleto ou documento de arrecadação do IPTU do ano' },
  { tipo: 'registro', titulo: 'Matrícula ou escritura (recomendado)', dica: 'certidão da matrícula e/ou escritura de compra — confere titulares, endereço, áreas e preço pago (lida por IA)' },
  { tipo: 'outro', titulo: 'Outros documentos (opcional)', dica: 'ficha cadastral (BCI), memória de cálculo…', varios: true },
]

// O que cada vaga faz, para a lista de etapas
const ETAPA: Record<Tipo, string> = {
  carne: 'Extração dos dados do carnê',
  laudo: 'Extração do laudo de vistoria',
  registro: 'Leitura da matrícula/escritura por IA',
  outro: 'Leitura de',
}
const segundos = (de: number, ate = Date.now()) => Math.max(0, Math.round((ate - de) / 1000))

/** Passo 1: o proprietário envia os PDFs que tem; cada um é lido no backend. */
export default function Documentos({ iaDisponivel, aoMontar }: {
  iaDisponivel: boolean
  aoMontar: (extracoes: Extracao[]) => Promise<void>
}) {
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [usarIA, setUsarIA] = useState(iaDisponivel)
  useEffect(() => setUsarIA(iaDisponivel), [iaDisponivel])
  const [montando, setMontando] = useState(false)
  // clicou em "Montar" com documentos ainda em leitura: monta sozinho quando terminarem
  const [pedido, setPedido] = useState(false)
  const [, setRelogio] = useState(0)
  const [erro, setErro] = useState<string | null>(null)

  async function adiciona(tipo: Tipo, arquivos: FileList | null) {
    if (!arquivos?.length) return
    const novos = [...arquivos].map((arquivo): Linha => ({ tipo, arquivo, estado: 'lendo', inicio: Date.now() }))
    // laudo e carnê: um arquivo por vaga; escolher de novo substitui
    setLinhas((l) => [...(tipo === 'outro' ? l : l.filter((x) => x.tipo !== tipo)), ...novos])
    await Promise.all(novos.map(async (n) => {
      try {
        const resultado = await api.documento(n.arquivo, usarIA, tipo)
        const estado = resultado.extracao ? 'ok' : 'erro'
        setLinhas((l) => l.map((x) => (x === n ? { ...x, estado, resultado, erro: resultado.erro, fim: Date.now() } : x)))
      } catch (e) {
        setLinhas((l) => l.map((x) => (x === n ? { ...x, estado: 'erro', erro: (e as Error).message, fim: Date.now() } : x)))
      }
    }))
  }

  const extracoes = linhas.flatMap((l) => (l.resultado?.extracao ? [l.resultado.extracao] : []))
  const lendo = linhas.some((l) => l.estado === 'lendo')

  async function monta() {
    setPedido(false); setMontando(true); setErro(null)
    try { await aoMontar(extracoes) } catch (e) { setErro((e as Error).message) } finally { setMontando(false) }
  }

  // relógio das etapas em andamento
  useEffect(() => {
    if (!lendo && !montando) return
    const t = setInterval(() => setRelogio((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [lendo, montando])

  useEffect(() => {
    if (!pedido || lendo) return
    if (extracoes.length) monta()
    else { setPedido(false); setErro('Nenhum documento foi lido com sucesso: veja os erros acima.') }
  }, [pedido, lendo])

  const temRegistro = linhas.some((l) => l.tipo === 'registro' && l.estado === 'ok')
  const podeMontar = linhas.some((l) => l.estado !== 'erro') && !montando && !pedido

  return (
    <section className="cartao">
      <h2>1. Documentos</h2>
      <p className="fraco">Envie os documentos em PDF. Os dados são lidos automaticamente; você confere tudo no passo seguinte.</p>
      <div className="vagas">
        {VAGAS.map((v) => {
          const daVaga = linhas.filter((l) => l.tipo === v.tipo)
          return (
            <div key={v.tipo} className={`vaga ${daVaga.some((l) => l.estado === 'ok') ? 'preenchida' : ''}`}>
              <h3>{v.titulo}</h3>
              <p className="fraco">{v.dica}</p>
              <label className="escolher">
                {daVaga.length && !v.varios ? 'Trocar arquivo' : v.varios && daVaga.length ? 'Adicionar outro' : 'Escolher PDF'}
                <input type="file" accept="application/pdf" multiple={v.varios} hidden
                  onChange={(e) => { adiciona(v.tipo, e.target.files); e.target.value = '' }} />
              </label>
              {daVaga.map((l, i) => (
                <div key={i} className="arquivo">
                  <span className="nome">{l.arquivo.name}</span>
                  {l.estado === 'lendo' && <span className="fraco"> — lendo…</span>}
                  {l.estado === 'erro' && <span className="texto-erro"> — {l.erro}</span>}
                  {l.estado === 'ok' && (() => {
                    const ex = l.resultado!.extracao!
                    const errado = v.tipo !== 'outro' && ex.fonte !== v.tipo
                    return (
                      <>
                        <span className="fraco"> — {ex.documento}, {Object.keys(ex.origens).length} campos</span>
                        <span className={`tag ${l.resultado!.metodo}`}>{l.resultado!.metodo === 'ia' ? 'IA' : 'extrator'}</span>
                        {errado && <span className="texto-erro"> · não parece um {v.titulo.toLowerCase()}</span>}
                      </>
                    )
                  })()}
                </div>
              ))}
            </div>
          )
        })}
      </div>
      <label className={iaDisponivel ? '' : 'fraco'} title="Para formatos sem extrator próprio. Leva ~30 s e custa alguns centavos por documento.">
        <input type="checkbox" checked={usarIA} disabled={!iaDisponivel} onChange={(e) => setUsarIA(e.target.checked)} />
        {' '}ler por IA os formatos desconhecidos{!iaDisponivel && ' (sem chave da API no backend)'}
      </label>
      {(lendo || pedido || montando) && (
        <div className="etapas">
          <h3>{montando ? 'Montando o caso…' : pedido ? 'Aguardando a leitura dos documentos para montar o caso…' : 'Lendo os documentos…'}</h3>
          <ul>
            {linhas.map((l, i) => (
              <li key={i} className={l.estado}>
                <span className="icone">{l.estado === 'lendo' ? '⏳' : l.estado === 'ok' ? '✓' : '✗'}</span>
                {ETAPA[l.tipo]}{l.tipo === 'outro' && ` ${l.arquivo.name}`}
                {l.estado === 'lendo' && <span className="fraco"> — {segundos(l.inicio)} s{l.tipo === 'registro' || usarIA ? ' (a leitura por IA leva até 1 minuto)' : ''}</span>}
                {l.estado === 'ok' && <span className="fraco"> — {l.resultado!.metodo === 'ia' ? 'lido por IA' : 'extrator'}, {segundos(l.inicio, l.fim)} s</span>}
                {l.estado === 'erro' && <span className="texto-erro"> — {l.erro} (o caso é montado sem ele)</span>}
              </li>
            ))}
            <li className={montando ? 'lendo' : 'espera'}>
              <span className="icone">{montando ? '⏳' : '·'}</span>
              Cruzamento dos documentos{temRegistro && ' e conferência com a matrícula'}
            </li>
            <li className="espera">
              <span className="icone">·</span>
              Depois: classificação do imóvel pela IA, no passo 3 (botão "Sugerir pelo laudo")
            </li>
          </ul>
        </div>
      )}
      {erro && <p className="erro">{erro}</p>}
      <div className="acoes">
        <button className="primario" disabled={!podeMontar} onClick={() => (lendo ? setPedido(true) : monta())}>
          {montando ? 'Montando…' : pedido ? 'Aguardando a leitura…' : 'Montar o caso'}
        </button>
        {pedido && <button onClick={() => setPedido(false)}>Cancelar</button>}
        {linhas.length > 0 && <button onClick={() => setLinhas([])} disabled={lendo}>Limpar</button>}
        {!lendo && extracoes.length > 0 && !linhas.some((l) => l.tipo === 'carne' && l.estado === 'ok') &&
          <span className="fraco">Sem o carnê não dá para simular a redução.</span>}
      </div>
    </section>
  )
}
