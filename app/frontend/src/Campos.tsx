import { useState } from 'react'
import { api, brl, num, type Caso } from './api'
import { GRUPOS, ROTULO_FONTE, pega, poe, type Campo } from './rotulos'

/** Passo 2: dados do caso, com a origem de cada um; o que falta fica em destaque e é editável. */
export default function Campos({ caso, iaDisponivel, aoMudar }: { caso: Caso; iaDisponivel: boolean; aoMudar: (c: Caso) => void }) {
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

      <RegistroImovel caso={caso} iaDisponivel={iaDisponivel} aoMudar={aoMudar} />

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

/**
 * Matrícula/escritura: não altera os dados acima, só confere. Pode ser enviada depois
 * de montado o caso; a conferência vira alertas que começam com "Matrícula".
 */
function RegistroImovel({ caso, iaDisponivel, aoMudar }: { caso: Caso; iaDisponivel: boolean; aoMudar: (c: Caso) => void }) {
  const [lendo, setLendo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const reg = caso.registro

  async function envia(arquivo: File | undefined) {
    if (!arquivo) return
    setLendo(true); setErro(null)
    try {
      const r = await api.documento(arquivo, true, 'registro')
      const novo = r.extracao?.registro
      if (!novo) throw new Error(r.erro ?? 'não consegui ler o documento')
      const { alertas } = await api.conferirRegistro(caso, novo)
      aoMudar({
        ...caso, registro: novo,
        alertas: [...caso.alertas.filter((a) => !a.startsWith('Matrícula') && !a.startsWith(arquivo.name)), ...r.extracao!.alertas, ...alertas],
        origens: { ...caso.origens, ...r.extracao!.origens },
      })
    } catch (e) { setErro((e as Error).message) } finally { setLendo(false) }
  }

  return (
    <div className="laudo">
      <h3>Matrícula / escritura</h3>
      {reg ? (
        <>
          <p>{reg.documentos}</p>
          <table className="campos">
            <tbody>
              <tr><td className="rotulo">Titulares atuais</td><td>{reg.proprietarios.map((p) => `${p.nome}${p.cpf ? ` (CPF ${p.cpf})` : ''}`).join('; ') || '—'}</td></tr>
              <tr><td className="rotulo">Cadastro citado</td><td>{reg.inscricao_cadastral ?? '—'}</td></tr>
              <tr><td className="rotulo">Endereço</td><td>{[reg.endereco.logradouro, reg.endereco.numero, reg.endereco.bairro].filter(Boolean).join(', ') || '—'}</td></tr>
              <tr><td className="rotulo">Terreno</td><td>{reg.area_terreno_m2 != null ? `${num(reg.area_terreno_m2)} m²` : '—'}{reg.medidas_terreno && ` — ${reg.medidas_terreno}`}</td></tr>
              <tr><td className="rotulo">Construção</td><td>{reg.descricao_construcao ?? '—'}{reg.area_construida_m2 != null && ` (${num(reg.area_construida_m2)} m² averbados)`}</td></tr>
              {reg.transacao && (
                <tr><td className="rotulo">Última compra</td><td>
                  {reg.transacao.data?.split('-').reverse().join('/') ?? 'data ?'} por {brl(reg.transacao.valor)}
                  {reg.transacao.valor_venal_declarado != null && <> · valor venal na época {brl(reg.transacao.valor_venal_declarado)}</>}
                  {reg.transacao.valor_referencia != null && <> · referência ITBI {brl(reg.transacao.valor_referencia)}</>}
                </td></tr>
              )}
            </tbody>
          </table>
          <p className="fraco">O resultado da conferência está nos alertas, no topo da página.</p>
        </>
      ) : (
        <p className="fraco">Não enviada. A matrícula (ou a escritura) confere titulares, endereço, inscrição, áreas e o preço pago contra o carnê e serve de comprovante de vínculo no requerimento.</p>
      )}
      <label className={`escolher ${iaDisponivel && !lendo ? '' : 'fraco'}`}>
        {lendo ? 'Lendo por IA…' : reg ? 'Trocar documento' : 'Enviar matrícula ou escritura (PDF)'}
        <input type="file" accept="application/pdf" hidden disabled={!iaDisponivel || lendo}
          onChange={(e) => { envia(e.target.files?.[0]); e.target.value = '' }} />
      </label>
      {!iaDisponivel && <span className="fraco"> (precisa da leitura por IA)</span>}
      {erro && <p className="erro">{erro}</p>}
    </div>
  )
}
