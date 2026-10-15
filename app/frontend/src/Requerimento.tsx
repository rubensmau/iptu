import { useEffect, useState } from 'react'
import { api, type Caso, type Lacuna } from './api'

const GRUPOS: { gravidade: Lacuna['gravidade']; titulo: string }[] = [
  { gravidade: 'bloqueia', titulo: 'Impedem o cálculo' },
  { gravidade: 'preencher', titulo: 'Dados e documentos a fornecer' },
  { gravidade: 'conferir', titulo: 'Pontos a conferir ou decidir' },
]

/** Passo 5: o que falta para protocolar e o rascunho do requerimento (.docx), gerado mesmo com lacunas. */
export default function Requerimento({ caso, temPerfil }: { caso: Caso; temPerfil: boolean }) {
  const [lacunas, setLacunas] = useState<Lacuna[] | null>(null)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const chave = JSON.stringify([caso.municipio, caso.requerente, caso.imovel, caso.lancamento, caso.classificacao, caso.confirmacoes, caso.origens])

  useEffect(() => {
    let vivo = true
    api.lacunas(caso).then((r) => vivo && setLacunas(r.lacunas)).catch((e) => vivo && setErro((e as Error).message))
    return () => { vivo = false }
  }, [chave])

  async function gerar() {
    setGerando(true); setErro(null)
    try { await api.requerimento(caso) } catch (e) { setErro((e as Error).message) } finally { setGerando(false) }
  }

  return (
    <section className="cartao">
      <h2>5. Requerimento</h2>
      <p className="fraco">
        O rascunho sai mesmo com lacunas: cada uma vem em amarelo no texto e listada numa caixa no início do documento,
        que deve ser removida antes de protocolar. O pedido é assinado pelo proprietário e independe do laudo, que vai como relatório fotográfico.
      </p>
      {lacunas && GRUPOS.map((g) => {
        const itens = lacunas.filter((l) => l.gravidade === g.gravidade)
        return itens.length > 0 && (
          <div key={g.gravidade} className={`lacunas ${g.gravidade}`}>
            <h3>{g.titulo} ({itens.length})</h3>
            <ul>{itens.map((l, i) => <li key={i}>{l.texto}</li>)}</ul>
          </div>
        )
      })}
      {erro && <p className="erro">{erro}</p>}
      <div className="acoes">
        <button className="primario" onClick={gerar} disabled={!temPerfil || gerando}>
          {gerando ? 'Gerando…' : 'Gerar rascunho do requerimento (.docx)'}
        </button>
        {!temPerfil && <span className="fraco">Precisa de um município com perfil cadastrado.</span>}
      </div>
    </section>
  )
}
