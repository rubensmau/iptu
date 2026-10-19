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
  const [gerando, setGerando] = useState<'preparatorio' | 'final' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const chave = JSON.stringify([caso.municipio, caso.requerente, caso.imovel, caso.lancamento, caso.classificacao, caso.confirmacoes, caso.origens])

  useEffect(() => {
    let vivo = true
    api.lacunas(caso).then((r) => vivo && setLacunas(r.lacunas)).catch((e) => vivo && setErro((e as Error).message))
    return () => { vivo = false }
  }, [chave])

  async function gerar(versao: 'preparatorio' | 'final') {
    setGerando(versao); setErro(null)
    try { await api.requerimento(caso, versao === 'final') } catch (e) { setErro((e as Error).message) } finally { setGerando(null) }
  }

  return (
    <section className="cartao">
      <h2>5. Requerimento</h2>
      <p className="fraco">
        Duas versões: a <b>preparatória</b>, para revisar, traz cada lacuna em amarelo e a lista de pendências e ressalvas no início;
        a <b>final</b>, para entregar à Prefeitura, sai sem destaques nem anotações, e o que faltar vira uma linha em branco para preencher à mão.
        O pedido é assinado pelo proprietário e independe do laudo, que vai como relatório fotográfico.
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
        <button onClick={() => gerar('preparatorio')} disabled={!temPerfil || !!gerando}>
          {gerando === 'preparatorio' ? 'Gerando…' : 'Versão preparatória (.docx)'}
        </button>
        <button className="primario" onClick={() => gerar('final')} disabled={!temPerfil || !!gerando}
          title={lacunas?.length ? `${lacunas.length} pendência(s) ainda abertas: os campos faltantes saem em branco.` : undefined}>
          {gerando === 'final' ? 'Gerando…' : 'Versão final para a Prefeitura (.docx)'}
        </button>
        {!temPerfil && <span className="fraco">Precisa de um município com perfil cadastrado.</span>}
      </div>
    </section>
  )
}
