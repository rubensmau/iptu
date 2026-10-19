// O que ainda falta para o requerimento poder ser protocolado. O rascunho é gerado
// mesmo com lacunas: cada uma aparece destacada no .docx e listada na tela.
import { acessoriasValidas, cenarios, simular, type Simulacao } from './calc.js';
import { comparaMercado } from './mercado.js';
import type { Caso, Gravidade, Lacuna, PerfilMunicipio } from './tipos.js';

export type { Gravidade, Lacuna } from './tipos.js';

/** Simulação do cenário escolhido na classificação, ou null se ainda não dá para calcular. */
export function simulacaoDoCaso(caso: Caso, perfil: PerfilMunicipio | null): Simulacao | null {
  const c = caso.classificacao;
  if (!perfil || !c.tipologia || !c.padrao || !c.conservacao) return null;
  try {
    return simular(caso, perfil, { tipologia: c.tipologia, padrao: c.padrao, conservacao: c.conservacao, acessorias: c.acessorias });
  } catch { return null; }
}

export function lacunas(caso: Caso, perfil: PerfilMunicipio | null): Lacuna[] {
  const out: Lacuna[] = [];
  const add = (gravidade: Gravidade, texto: string) => out.push({ gravidade, texto });
  const c = caso.classificacao, l = caso.lancamento, r = caso.requerente;

  if (!perfil) add('bloqueia', `Município "${caso.municipio}" sem perfil cadastrado: não há lei, tabela nem fundamentação para o pedido.`);
  if (l.valor_venal_edificacao == null || l.iptu_anual == null) add('bloqueia', 'Faltam os valores do lançamento (envie o carnê do IPTU ou digite-os no passo 2).');
  if (!c.padrao || !c.conservacao) add('bloqueia', 'Classificação incompleta: escolha tipologia, padrão e estado de conservação (passo 3).');
  else if (perfil && !simulacaoDoCaso(caso, perfil)) add('bloqueia', 'A simulação do cenário escolhido não fecha (veja o erro no passo 4).');

  if (!r.nome) add('preencher', 'Nome do requerente.');
  if (!r.cpf || r.cpf.includes('*')) add('preencher', r.cpf ? `CPF completo do requerente (os documentos trazem só "${r.cpf}").` : 'CPF do requerente.');
  if (!r.telefone) add('preencher', 'Telefone do requerente.');
  if (!r.email) add('preencher', 'E-mail do requerente.');
  if (!caso.imovel.inscricao) add('preencher', 'Inscrição municipal do imóvel.');

  const pendentes = caso.confirmacoes.filter((q) => !q.resposta);
  if (pendentes.length) add('preencher', `${pendentes.length} confirmação(ões) do passo 3 sem resposta: ${pendentes.map((q) => q.pergunta).join(' / ')}`);
  if (c.padrao && caso.origens['classificacao.padrao']?.fonte === 'julgamento') {
    add('conferir', 'Padrão e conservação ainda são a sugestão da IA: confirme no passo 3.');
  }
  const semArea = (c.acessorias ?? []).filter((b) => !b.area_m2);
  if (semArea.length) {
    add('preencher', `Área (m²) de ${semArea.map((b) => b.descricao).join(', ')}: o laudo não traz a metragem por ambiente. Sem ela o bloco fica fora do cálculo e o pedido só pede o enquadramento.`);
  }
  if (perfil && c.acessorias?.length && !acessoriasValidas(c.acessorias, perfil).length && !semArea.length) {
    add('conferir', 'Nenhuma área acessória pôde ser calculada (padrão inexistente na tabela?).');
  }
  if (!c.acessorias?.length && /telheiro|garagem|servi/i.test(c.areas_acessorias ?? '')) {
    add('conferir', 'A análise do laudo menciona áreas acessórias, mas nenhuma foi incluída como bloco à parte (passo 3).');
  }
  if (!caso.laudo) add('preencher', 'Sem laudo de vistoria: o pedido fica sem relatório fotográfico e sem os quadros de características e estado.');
  if (!c.caracteristicas.length && caso.laudo) add('conferir', 'Quadros de características e estado (seção III) vazios: rode a análise do laudo (passo 3) ou preencha à mão no .docx.');

  if (perfil) {
    const piores = cenarios(caso, perfil).filter((s) => s.cenario.padrao === c.padrao && (s.reducao_iptu ?? 0) < 0);
    if (piores.length) {
      add('conferir', `Risco: se a prefeitura concluir ${piores.map((s) => s.cenario.conservacao).join(' ou ')}, o IPTU sobe. O pedido não pede vistoria in loco — pede a análise do relatório fotográfico e só aceita vistoria se a prefeitura achar necessário.`);
    }
    for (const p of perfil.pendencias) add('conferir', `Perfil de ${perfil.nome}: ${p}`);
  }
  const mercado = comparaMercado(caso, perfil?.exercicio);
  if (mercado && mercado.excesso > 0) {
    add('conferir', `Argumento de valor de mercado incluído (valor venal ${Math.round(mercado.excesso * 100)}% acima do preço de ${mercado.data_compra.slice(0, 4)} corrigido pelo IPCA): decidir se fica; a Prefeitura pode alegar valorização real acima da inflação desde a compra — uma avaliação atual (corretor ou laudo NBR 14653) fortalece o pedido.`);
  }
  if (c.pontos_fracos.length) add('conferir', `${c.pontos_fracos.length} ponto(s) fraco(s) apontado(s) na análise do laudo: decida se o texto deve rebatê-los.`);

  add('preencher', 'Data e assinatura do proprietário (o pedido é dele, independente do laudo).');
  add('preencher', caso.registro
    ? 'Anexos: RG e CPF e, se outra pessoa protocolar, procuração (a matrícula/escritura já enviada serve de comprovante de vínculo).'
    : 'Anexos: RG e CPF, comprovante de vínculo com o imóvel (matrícula ou escritura — envie no passo 1 para conferir os dados), procuração se outra pessoa protocolar.');
  add('conferir', 'Sem ART/RRT: a aceitação de laudo fotográfico sem responsável técnico está sendo testada nos primeiros casos.');
  return out;
}
