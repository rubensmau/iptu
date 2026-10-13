import { useState } from 'react'
import { num, type Caso } from './api'
import { GRUPOS, ROTULO_FONTE, pega, poe, type Campo } from './rotulos'

/** Passo 2: dados do caso, com a origem de cada um; o que falta fica em destaque e é editável. */
export default function Campos({ caso, aoMudar }: { caso: Caso; aoMudar: (c: Caso) => void }) {
  const [verLaudo, setVerLaudo] = useState(false)
  const faltam = GRUPOS.flatMap((g) => g.campos).filter((c) => c.obrigatorio && pega(caso, c.caminho) == null)

  function edita(campo: Campo, bruto: string) {
    const v = bruto.trim() === '' ? null
      : campo.tipo === 'texto' ? bruto
      : campo.tipo === 'inteiro' ? Number(bruto.replace(/\D/g, ''))
      : Number(bruto.replace(/\./g, '').replace(',', '.'))
    if (v !== null && typeof v === 'number' && !Number.isFinite(v)) return
    let novo = poe(caso, campo.caminho, v)
    novo = { ...novo, origens: { ...novo.origens, [campo.caminho]: { fonte: 'usuario', ref: 'digitado na tela' } } }
    aoMudar(novo)
  }

  const laudo = caso.laudo
  return (
    <section className="cartao">
      <h2>2. Dados do caso</h2>
      {faltam.length > 0
        ? <p className="aviso">Faltam {faltam.length} dado(s): {faltam.map((c) => c.rotulo).join(', ')}.</p>
        : <p className="ok">Todos os dados obrigatórios estão preenchidos.</p>}
      <div className="grupos">
        {GRUPOS.map((g) => (
          <div key={g.titulo}>
            <h3>{g.titulo}</h3>
            <table className="campos">
              <tbody>
                {g.campos.map((c) => {
                  const v = pega(caso, c.caminho)
                  const o = caso.origens[c.caminho] ?? caso.origens[c.caminho.split('.')[0]]
                  const mostra = v == null ? '' : c.tipo === 'texto' || c.tipo === 'inteiro' ? String(v) : num(v as number, c.tipo === 'reais' ? 2 : Number.isInteger(v) ? 0 : 2)
                  return (
                    <tr key={c.caminho} className={v == null && c.obrigatorio ? 'falta' : ''}>
                      <td className="rotulo">{c.rotulo}</td>
                      <td>
                        <input
                          key={`${c.caminho}:${mostra}`}
                          defaultValue={mostra}
                          placeholder={c.obrigatorio ? 'preencher' : ''}
                          onBlur={(e) => { if (e.target.value !== mostra) edita(c, e.target.value) }}
                        />
                      </td>
                      <td>
                        {o && <span className={`tag fonte-${o.fonte}`} title={[o.ref, o.valor_original].filter(Boolean).join(' — ')}>
                          {ROTULO_FONTE[o.fonte] ?? o.fonte}
                        </span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {laudo && (
        <div className="laudo">
          <h3>Laudo</h3>
          <p>
            {laudo.tipo ?? 'Laudo'} {laudo.numero_documento && <>nº {laudo.numero_documento}</>}
            {laudo.id_vistoria && laudo.id_vistoria !== laudo.numero_documento && <> (vistoria {laudo.id_vistoria})</>}
            {laudo.data && <>, de {laudo.data.split('-').reverse().join('/')}</>}
            {laudo.area_util_m2 != null && <> · área útil {num(laudo.area_util_m2)} m²</>}
            {laudo.total_fotos != null && <> · {laudo.total_fotos} fotos</>}
            {' · '}{laudo.ambientes.length} ambientes
          </p>
          <button onClick={() => setVerLaudo(!verLaudo)}>{verLaudo ? 'Esconder' : 'Ver'} as observações</button>
          {verLaudo && (
            <div className="ambientes">
              {laudo.ambientes.map((a) => (
                <div key={a.numero}>
                  <h4>{a.numero}. {a.nome}</h4>
                  {a.observacoes.map((o, i) => <p key={i}>{o}</p>)}
                </div>
              ))}
              {laudo.observacoes_gerais.length > 0 && <div><h4>Observações gerais</h4>{laudo.observacoes_gerais.map((o, i) => <p key={i}>{o}</p>)}</div>}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
