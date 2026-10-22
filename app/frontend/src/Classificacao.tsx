import { useEffect, useRef, useState } from 'react'
import { api, num, type BlocoConstrucao, type Caso, type Confirmacao, type Municipio } from './api'
import { poe } from './rotulos'

/**
 * Passo 3: tipologia, padrão e estado de conservação. A IA sugere e explica;
 * cada critério subjetivo vira uma pergunta, e vale a resposta do proprietário.
 */
export default function Classificacao({ caso, municipio, iaDisponivel, aoMudar }: {
  caso: Caso
  municipio: Municipio | null
  iaDisponivel: boolean
  aoMudar: (c: Caso) => void
}) {
  const [trabalho, setTrabalho] = useState<{ id: string; segundos: number } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [recalculado, setRecalculado] = useState<string | null>(null) // hora do último recálculo
  const casoRef = useRef(caso)
  casoRef.current = caso
  const cl = caso.classificacao
  // mexeu na classificação depois do recálculo: a confirmação deixa de valer
  useEffect(() => setRecalculado(null), [cl])

  useEffect(() => {
    if (!trabalho) return
    const t = setInterval(async () => {
      try {
        const r = await api.trabalho(trabalho.id)
        if (r.status === 'rodando') { setTrabalho({ id: trabalho.id, segundos: r.segundos }); return }
        clearInterval(t); setTrabalho(null)
        if (r.status === 'erro') { setErro(r.erro ?? 'falha na classificação'); return }
        const res = r.resultado!
        const c = casoRef.current
        const origem = { fonte: 'julgamento' as const, ref: `${res.uso.modelo}, a confirmar` }
        aoMudar({
          ...c,
          classificacao: res.classificacao,
          confirmacoes: res.confirmacoes,
          alertas: [...c.alertas.filter((a) => !a.startsWith('Risco:')), ...res.alertas],
          origens: {
            ...c.origens,
            'classificacao.tipologia': origem, 'classificacao.padrao': origem, 'classificacao.conservacao': origem,
          },
        })
      } catch (e) { clearInterval(t); setTrabalho(null); setErro((e as Error).message) }
    }, 3000)
    return () => clearInterval(t)
  }, [trabalho?.id])

  async function sugerir() {
    setErro(null)
    try { const { id } = await api.classificar(caso); setTrabalho({ id, segundos: 0 }) } catch (e) { setErro((e as Error).message) }
  }

  // valores refeitos com padrão, blocos e áreas da tela, sem chamar a IA
  async function recalcular() {
    setErro(null); setRecalculado(null)
    try {
      const r = await api.recalcular(caso)
      aoMudar({ ...caso, confirmacoes: r.confirmacoes, alertas: [...caso.alertas.filter((a) => !a.startsWith('Risco:')), ...r.alertas] })
      setRecalculado(new Date().toLocaleTimeString('pt-BR'))
    } catch (e) { setErro((e as Error).message) }
  }

  function escolhe(campo: 'tipologia' | 'padrao' | 'conservacao', valor: string) {
    aoMudar({
      ...poe(caso, `classificacao.${campo}`, valor || null),
      origens: { ...caso.origens, [`classificacao.${campo}`]: { fonte: 'usuario', ref: 'escolhido na tela' } },
    })
  }

  function responde(q: Confirmacao, resposta: string) {
    let novo: Caso = { ...caso, confirmacoes: caso.confirmacoes.map((x) => (x.id === q.id ? { ...x, resposta } : x)) }
    // a resposta só altera o caso quando é um valor válido do campo (ex.: "Regular")
    const campo = q.campo?.replace('classificacao.', '') as 'tipologia' | 'padrao' | 'conservacao' | undefined
    const validos = campo === 'conservacao' ? municipio?.conservacao
      : campo === 'padrao' ? Object.values(municipio?.padroes ?? {}).flat()
      : campo === 'tipologia' ? Object.keys(municipio?.padroes ?? {}) : undefined
    // o modelo às vezes enfeita a opção ("Regular (0,80)"): vale o nome do perfil no início
    const valor = validos?.find((v) => resposta === v || resposta.startsWith(`${v} `) || resposta.startsWith(`${v}(`))
    if (q.campo && valor) {
      novo = { ...poe(novo, q.campo, valor), origens: { ...novo.origens, [q.campo]: { fonte: 'usuario', ref: 'confirmado na tela' } } }
    }
    aoMudar(novo)
  }

  const padroes = municipio?.padroes?.[cl.tipologia ?? ''] ?? []
  const pendentes = caso.confirmacoes.filter((q) => !q.resposta).length

  return (
    <section className="cartao">
      <h2>3. Classificação do imóvel</h2>
      {!municipio && <p className="aviso">Município sem perfil cadastrado: não há tabela de padrões para classificar.</p>}
      {municipio && (
        <>
          <div className="linha">
            <label>Tipologia{' '}
              <select value={cl.tipologia ?? ''} onChange={(e) => escolhe('tipologia', e.target.value)}>
                <option value="">—</option>
                {Object.keys(municipio.padroes).map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label>Padrão{' '}
              <select value={cl.padrao ?? ''} onChange={(e) => escolhe('padrao', e.target.value)}>
                <option value="">—</option>
                {padroes.map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>
            <label>Conservação{' '}
              <select value={cl.conservacao ?? ''} onChange={(e) => escolhe('conservacao', e.target.value)}>
                <option value="">—</option>
                {municipio.conservacao.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <button className="primario" onClick={sugerir} disabled={!iaDisponivel || !!trabalho || !caso.laudo?.ambientes.length}
              title="Lê as observações do laudo e sugere o enquadramento. Leva 1–2 minutos e custa ~US$ 0,20.">
              {trabalho ? `Analisando o laudo… ${trabalho.segundos} s` : cl.caracteristicas.length ? 'Sugerir de novo (IA)' : 'Sugerir pelo laudo (IA)'}
            </button>
          </div>
          {padroes.length <= 1 && cl.tipologia && (
            <p className="fraco">O perfil de {municipio.nome} só tem {padroes.length} padrão para {cl.tipologia}: a lei (Anexos II e IV) ainda não foi levantada por completo.</p>
          )}
          <Blocos caso={caso} municipio={municipio} aoMudar={aoMudar} />
          <div className="linha">
            <button onClick={recalcular} disabled={!!trabalho || !cl.tipologia || !cl.padrao}
              title="Refaz o efeito de cada estado de conservação no IPTU e o alerta de risco com os ambientes e áreas da tela. Não chama a IA.">
              Recalcular valores
            </button>
          </div>
          {recalculado && (
            <p className="ok">
              ✓ Valores recalculados às {recalculado}. O efeito de cada estado de conservação está na pergunta de conservação, abaixo;
              o resultado completo (quadro comparativo e memória de cálculo) está no{' '}
              <a href="#simulacao" onClick={(e) => { e.preventDefault(); document.getElementById('simulacao')?.scrollIntoView({ behavior: 'smooth' }) }}>item 4. Simulação</a>.
            </p>
          )}
        </>
      )}
      {erro && <p className="erro">{erro}</p>}

      {cl.caracteristicas.length > 0 && (
        <>
          <p>
            Sugestão: <b>{cl.tipologia} {cl.padrao}, estado {cl.conservacao}</b>
            {cl.confianca && <> · confiança {cl.confianca}</>}
          </p>
          <details>
            <summary>Características construtivas ({cl.caracteristicas.length})</summary>
            <Quadro linhas={cl.caracteristicas} />
          </details>
          <details>
            <summary>Estado de conservação ({cl.estado.length})</summary>
            <Quadro linhas={cl.estado} />
          </details>
          {cl.areas_acessorias && <details><summary>Áreas acessórias</summary><p>{cl.areas_acessorias}</p></details>}
          {cl.pontos_fracos.length > 0 && (
            <details open>
              <summary>Pontos fracos do pedido ({cl.pontos_fracos.length})</summary>
              <ul>{cl.pontos_fracos.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </details>
          )}
        </>
      )}

      {caso.confirmacoes.length > 0 && (
        <div className="confirmacoes">
          <h3>Confirme {pendentes ? `(${pendentes} pendente${pendentes > 1 ? 's' : ''})` : '✓'}</h3>
          {caso.confirmacoes.map((q) => (
            <div key={q.id} className={`pergunta ${q.resposta ? 'respondida' : ''}`}>
              <p className="enunciado">{q.pergunta}</p>
              {q.opcoes.map((o) => (
                <label key={o} className="opcao">
                  <input type="radio" name={q.id} checked={q.resposta === o} onChange={() => responde(q, o)} />
                  {' '}{o}{o === q.sugestao && <span className="tag sugestao">sugerido</span>}
                </label>
              ))}
              <p className="fraco">{q.justificativa}</p>
              {q.impacto && <p className="impacto">{q.impacto}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function Quadro({ linhas }: { linhas: { elemento: string; evidencias: string; conclusao: string }[] }) {
  return (
    <table>
      <thead><tr><th>Elemento</th><th>Evidências do laudo</th><th>Conclusão</th></tr></thead>
      <tbody>{linhas.map((l, i) => <tr key={i}><td className="nome">{l.elemento}</td><td>{l.evidencias}</td><td>{l.conclusao}</td></tr>)}</tbody>
    </table>
  )
}

/**
 * Classificação por ambiente: partes da construção (garagem, área de serviço...) enquadradas
 * à parte, cada uma com seus m². A área delas sai do corpo principal no cálculo.
 */
function Blocos({ caso, municipio, aoMudar }: { caso: Caso; municipio: Municipio; aoMudar: (c: Caso) => void }) {
  const blocos = caso.classificacao.acessorias ?? []
  const muda = (novos: BlocoConstrucao[]) => aoMudar({ ...caso, classificacao: { ...caso.classificacao, acessorias: novos } })
  const edita = (i: number, campos: Partial<BlocoConstrucao>) => muda(blocos.map((b, j) => (j === i ? { ...b, ...campos } : b)))
  const tipologias = Object.keys(municipio.padroes)
  const padroesDe = (t: string) => municipio.padroes[t] ?? []
  function adiciona() {
    const tipologia = tipologias.includes('Telheiro') ? 'Telheiro' : tipologias[0]
    const padroes = padroesDe(tipologia)
    muda([...blocos, {
      descricao: blocos.length ? 'Área de serviço' : 'Garagem', ambientes: null, tipologia,
      padrao: padroes.includes('Popular') ? 'Popular' : padroes[0], conservacao: municipio.conservacao.includes('Regular') ? 'Regular' : municipio.conservacao[0], area_m2: null,
    }])
  }
  const total = blocos.reduce((t, b) => t + (b.area_m2 ?? 0), 0)
  const construida = caso.imovel.area_construida_m2
  const principal = caso.classificacao.area_principal_m2 ?? null
  const vistoria = principal ? principal + total : null
  const diverge = vistoria != null && construida != null && Math.abs(vistoria - construida) >= 0.01
  const lerArea = (texto: string) => (texto.trim() === '' ? null : Number(texto.replace(/\./g, '').replace(',', '.')))

  return (
    <div className="confirmacoes">
      <h3>Classificação por ambiente (áreas à parte)</h3>
      <p className="fraco">
        Garagem, área de serviço e outras coberturas podem ter enquadramento próprio (ex.: Telheiro, bem mais barato que Casa).
        O valor de cada bloco é proporcional aos seus m². O laudo não traz a metragem por ambiente: meça e informe a área.
        Vale a área construída do cadastro: se medir também o corpo principal e a soma divergir do cadastro, as áreas são ajustadas na mesma proporção.
      </p>
      {blocos.length > 0 && (
        <table className="blocos">
          <thead><tr><th>Bloco</th><th>Tipologia</th><th>Padrão</th><th>Conservação</th><th className="num">Área (m²)</th><th /></tr></thead>
          <tbody>
            <tr>
              <td>Corpo principal</td>
              <td colSpan={3} className="fraco">{caso.classificacao.tipologia ?? '—'} {caso.classificacao.padrao ?? ''}, {caso.classificacao.conservacao ?? '—'} · demais ambientes</td>
              <td className="num">
                <input className="area" placeholder="opcional" key={`p:${principal}`} defaultValue={principal == null ? '' : num(principal)}
                  title="Área do corpo principal medida na vistoria. Sem ela, o corpo principal fica com o restante da área do cadastro."
                  onBlur={(e) => {
                    const v = lerArea(e.target.value)
                    if (v === null || (Number.isFinite(v) && v >= 0)) aoMudar({ ...caso, classificacao: { ...caso.classificacao, area_principal_m2: v || null } })
                  }} />
              </td>
              <td />
            </tr>
            {blocos.map((b, i) => (
              <tr key={i} className={b.area_m2 ? '' : 'falta'} title={b.ambientes ?? ''}>
                <td><input defaultValue={b.descricao} key={`d${i}:${b.descricao}`} onBlur={(e) => e.target.value !== b.descricao && edita(i, { descricao: e.target.value })} /></td>
                <td>
                  <select value={b.tipologia} onChange={(e) => edita(i, { tipologia: e.target.value, padrao: padroesDe(e.target.value)[0] ?? '' })}>
                    {tipologias.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </td>
                <td>
                  <select value={b.padrao} onChange={(e) => edita(i, { padrao: e.target.value })}>
                    {padroesDe(b.tipologia).map((p) => <option key={p}>{p}</option>)}
                  </select>
                </td>
                <td>
                  <select value={b.conservacao} onChange={(e) => edita(i, { conservacao: e.target.value })}>
                    {municipio.conservacao.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </td>
                <td className="num">
                  <input className="area" placeholder="medir" key={`a${i}:${b.area_m2}`} defaultValue={b.area_m2 == null ? '' : num(b.area_m2)}
                    onBlur={(e) => {
                      const v = lerArea(e.target.value)
                      if (v === null || (Number.isFinite(v) && v >= 0)) edita(i, { area_m2: v || null })
                    }} />
                </td>
                <td><button onClick={() => muda(blocos.filter((_, j) => j !== i))} title="Remover bloco">×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="linha">
        <button onClick={adiciona}>+ Adicionar área à parte</button>
        {blocos.length > 0 && construida != null && !diverge && (
          <span className="fraco">Corpo principal: {num(construida - total)} m² de {num(construida)} m² do cadastro{blocos.some((b) => !b.area_m2) && ' (blocos sem área ficam fora do cálculo)'}.</span>
        )}
        {diverge && (
          <span className="aviso">
            Vistoria: {num(vistoria!)} m² × cadastro: {num(construida!)} m². No cálculo, cada área é multiplicada por {num(construida! / vistoria!, 4)}
            {' '}(detalhe na memória de cálculo, passo 4); o requerimento só menciona a divergência.
          </span>
        )}
      </div>
    </div>
  )
}
