import { useEffect, useState } from 'react'
import { api, brl, num, type Caso, type RespostaSimulacao } from './api'

const pct = (a: number) => `${(a * 100).toFixed(2).replace('.', ',')}%`

/** Passo 4: quadro comparativo lançamento × revisão, memória de cálculo e todos os cenários. */
export default function Simulacao({ caso }: { caso: Caso }) {
  const [r, setR] = useState<RespostaSimulacao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const chave = JSON.stringify([caso.classificacao.tipologia, caso.classificacao.padrao, caso.classificacao.conservacao, caso.classificacao.acessorias, caso.imovel, caso.lancamento])

  useEffect(() => {
    let vivo = true
    setErro(null)
    api.simular(caso).then((x) => vivo && setR(x)).catch((e) => vivo && setErro((e as Error).message))
    return () => { vivo = false }
  }, [chave])

  const s = r?.simulacao
  // com padrão escolhido, só as hipóteses daquele padrão
  const hipoteses = (r?.implicito?.blocos ?? []).filter((b) => !s || b.padrao === s.cenario.padrao)
  const l = caso.lancamento
  return (
    <section className="cartao">
      <h2>4. Simulação</h2>
      {erro && <p className="erro">{erro}</p>}
      {!s && !erro && <p className="fraco">Escolha tipologia, padrão e conservação para simular.</p>}
      {s && (
        <>
          <table>
            <thead><tr><th>Item</th><th className="num">Lançamento</th><th className="num">Revisão</th><th>Observação</th></tr></thead>
            <tbody>
              <tr><td>Área da construção</td><td className="num">{num(caso.imovel.area_construida_m2)} m²</td><td className="num">{num(s.cenario.area_m2)} m²</td>
                <td className="fraco">{s.blocos.length > 1 && s.blocos.map((b) => `${b.descricao}: ${num(b.area_m2)} m² ${b.tipologia} ${b.padrao} ${b.conservacao}`).join(' · ')}</td></tr>
              <tr><td>Valor efetivo da construção</td><td className="num">{brl(r!.implicito?.efetivo)}/m²</td><td className="num">{brl(s.valor_m2_efetivo)}/m²</td>
                <td className="fraco">{s.cenario.tipologia} {s.cenario.padrao}: {brl(s.valor_m2_tabela)} × {num(s.fator_conservacao)}</td></tr>
              <tr><td>Valor venal do terreno</td><td className="num">{brl(l.valor_venal_terreno)}</td><td className="num">{brl(s.revisado.valor_venal_terreno)}</td><td /></tr>
              <tr><td>Valor venal da construção</td><td className="num">{brl(l.valor_venal_edificacao)}</td><td className="num">{brl(s.revisado.valor_venal_edificacao)}</td><td /></tr>
              <tr><td>Valor venal total</td><td className="num">{brl(l.valor_venal_imovel)}</td><td className="num">{brl(s.revisado.valor_venal_imovel)}</td><td>{dif(s.reducao_vvi)}</td></tr>
              <tr><td>Alíquota</td><td className="num">{s.atual ? pct(s.atual.faixa.aliquota) : '—'}</td><td className="num">{pct(s.revisado.faixa.aliquota)}</td><td className="fraco">{s.revisado.faixa.ref}</td></tr>
              <tr className="destaque"><td>IPTU anual</td><td className="num">{brl(l.iptu_anual)}</td><td className="num">{brl(s.revisado.iptu_anual)}</td><td>{dif(s.reducao_iptu)}</td></tr>
              <tr><td>Coleta de lixo</td><td className="num">{brl(l.lixo_anual)}</td><td className="num">{brl(s.revisado.lixo_anual)}</td><td /></tr>
              <tr><td>Total anual</td><td className="num">{brl(l.total_lancado)}</td><td className="num">{brl(s.revisado.total)}</td><td>{dif(s.reducao_total)}</td></tr>
            </tbody>
          </table>
          {s.atual && l.iptu_anual != null && s.atual.iptu_anual !== l.iptu_anual && (
            <p className="aviso">O recálculo do lançamento pelas regras do perfil dá {brl(s.atual.iptu_anual)}, mas o carnê diz {brl(l.iptu_anual)} — confira o perfil do município.</p>
          )}
          <h3>Memória de cálculo</h3>
          <ul>{s.memoria.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </>
      )}
      {r && r.cenarios.length > 0 && (
        <>
          <h3>Cenários de {r.cenarios[0].cenario.tipologia} (padrão × conservação)</h3>
          <table>
            <thead><tr><th>Cenário</th><th className="num">Valor venal</th><th className="num">Alíquota</th><th className="num">IPTU</th><th>Efeito</th></tr></thead>
            <tbody>
              {r.cenarios.map((c, i) => (
                <tr key={i}>
                  <td>{c.cenario.tipologia} {c.cenario.padrao}, {c.cenario.conservacao}</td>
                  <td className="num">{brl(c.revisado.valor_venal_imovel)}</td>
                  <td className="num">{pct(c.revisado.faixa.aliquota)}</td>
                  <td className="num">{brl(c.revisado.iptu_anual)}</td>
                  <td>{dif(c.reducao_iptu)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {r.implicito && (
            <p className="fraco">
              O lançamento atual equivale a {brl(r.implicito.efetivo)}/m² de construção
              {r.implicito.padroes.map((p) => ` — fator ${num(p.fc_implicito, 4)} sobre ${p.tipologia} ${p.padrao}`).join('')}.
              {hipoteses.length > 0 && <> Nenhum fator da tabela fecha sozinho; hipóteses de divisão em blocos que fecham com o lançamento:{' '}
                {hipoteses.map((b) => `${num(b.area_principal)} m² de ${s?.cenario.tipologia ?? ''} ${b.padrao} ${b.conservacao} + ${num(b.area_telheiro)} m² de Telheiro ${b.telheiro}`).join('; ')}.</>}
            </p>
          )}
        </>
      )}
    </section>
  )
}

function dif(d: number | null) {
  if (d == null) return null
  if (Math.abs(d) < 0.005) return <span className="fraco">sem mudança</span>
  return d > 0 ? <span className="reduz">reduz {brl(d)}</span> : <span className="aumenta">AUMENTA {brl(-d)}</span>
}
