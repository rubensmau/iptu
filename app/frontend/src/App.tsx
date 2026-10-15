import { useEffect, useState } from 'react'
import { api, type Caso, type Municipio } from './api'
import Campos from './Campos'
import Classificacao from './Classificacao'
import Documentos from './Documentos'
import Requerimento from './Requerimento'
import Simulacao from './Simulacao'

const CHAVE = 'iptu_caso'

// o caso fica no navegador para não se perder ao recarregar; só conveniência
function lerCaso(): Caso | null {
  try { const cru = localStorage.getItem(CHAVE); return cru ? (JSON.parse(cru) as Caso) : null } catch { return null }
}
function guardarCaso(c: Caso | null) {
  try { c ? localStorage.setItem(CHAVE, JSON.stringify(c)) : localStorage.removeItem(CHAVE) } catch { /* sem armazenamento */ }
}

export default function App() {
  const [municipios, setMunicipios] = useState<Municipio[]>([])
  const [ia, setIa] = useState(false)
  const [caso, setCasoBruto] = useState<Caso | null>(lerCaso)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    api.municipios().then((r) => { setMunicipios(r.municipios); setIa(r.ia_disponivel) }).catch((e) => setErro(e.message))
  }, [])

  const setCaso = (c: Caso | null) => { setCasoBruto(c); guardarCaso(c) }
  const municipio = municipios.find((m) => m.id === caso?.municipio) ?? null

  function baixar() {
    if (!caso) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(caso, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url; a.download = `caso_${caso.imovel.inscricao ?? 'iptu'}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="pagina">
      <header>
        <h1>Revisão de IPTU <span className="versao">versão de {__VERSAO__}</span></h1>
        <p className="resumo">
          Monta o pedido de revisão do IPTU e do valor venal a partir dos documentos que você já tem.
          {municipios.length > 0 && <> Municípios com perfil: {municipios.map((m) => `${m.nome}/${m.uf}`).join(', ')}.</>}
        </p>
      </header>
      {erro && <p className="erro">Backend indisponível: {erro}</p>}

      {!caso && <Documentos iaDisponivel={ia} aoMontar={async (ex) => setCaso((await api.caso(ex)).caso)} />}

      {caso && (
        <>
          <div className="barra">
            <span>
              Município:{' '}
              <select value={caso.municipio} onChange={(e) => setCaso({ ...caso, municipio: e.target.value })}>
                {!municipio && <option value={caso.municipio}>{caso.municipio} (sem perfil)</option>}
                {municipios.map((m) => <option key={m.id} value={m.id}>{m.nome}/{m.uf} ({m.exercicio})</option>)}
              </select>
            </span>
            <span className="espaco" />
            <button onClick={baixar}>Baixar o caso (JSON)</button>
            <button onClick={() => { if (confirm('Começar outro imóvel? Os dados deste caso serão apagados da tela.')) setCaso(null) }}>Novo imóvel</button>
          </div>

          {caso.alertas.length > 0 && (
            <section className="cartao alertas">
              <h2>Alertas ({caso.alertas.length})</h2>
              <ul>{caso.alertas.map((a, i) => <li key={i} className={a.startsWith('Risco') ? 'risco' : ''}>{a}</li>)}</ul>
            </section>
          )}

          <Campos caso={caso} aoMudar={setCaso} />
          <Classificacao caso={caso} municipio={municipio} iaDisponivel={ia} aoMudar={setCaso} />
          {municipio && <Simulacao caso={caso} />}
          <Requerimento caso={caso} temPerfil={!!municipio} />
        </>
      )}
    </div>
  )
}
