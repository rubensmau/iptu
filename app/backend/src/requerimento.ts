// Gera o rascunho do requerimento de revisão (.docx) a partir do caso, do perfil
// do município e da simulação. Tudo o que falta sai destacado em amarelo
// ("[PREENCHER: ...]") e a primeira página lista as lacunas — ela é para quem
// revisa e deve ser removida antes de protocolar.
//
// Estrutura baseada no requerimento-exemplo de Mogi Mirim (revisao_iptu.docx),
// com os ajustes das respostas do sócio (docs/aprendizados_2026-10-15.md).
import {
  AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, ShadingType,
  Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx';
import { brl, num, valorImplicito, type Simulacao } from './calc.js';
import { lacunas, simulacaoDoCaso, type Lacuna } from './lacunas.js';
import type { Caso, ElementoAvaliado, PerfilMunicipio, RefRequerimento } from './tipos.js';

const AMARELO = 'yellow';
type Trecho = string | TextRun;

const t = (text: string, o: { bold?: boolean; italics?: boolean } = {}) => new TextRun({ text, ...o });
const falta = (o_que: string) => new TextRun({ text: `[PREENCHER: ${o_que}]`, highlight: AMARELO, bold: true });
const ou = (v: string | number | null | undefined, o_que: string): TextRun => (v == null || v === '' ? falta(o_que) : t(String(v)));

const par = (trechos: Trecho[] | string, o: { bold?: boolean; alinhamento?: (typeof AlignmentType)[keyof typeof AlignmentType]; depois?: number } = {}) =>
  new Paragraph({
    alignment: o.alinhamento ?? AlignmentType.JUSTIFIED,
    spacing: { after: o.depois ?? 120 },
    children: (typeof trechos === 'string' ? [trechos] : trechos).map((x) => (typeof x === 'string' ? t(x, { bold: o.bold }) : x)),
  });
const titulo = (texto: string) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 }, children: [t(texto)] });
const subtitulo = (texto: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 80 }, children: [t(texto)] });

const celula = (conteudo: Trecho[] | string, o: { negrito?: boolean; fundo?: string; largura?: number } = {}) =>
  new TableCell({
    width: o.largura ? { size: o.largura, type: WidthType.PERCENTAGE } : undefined,
    shading: o.fundo ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fundo } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [par(conteudo, { bold: o.negrito, alinhamento: AlignmentType.LEFT, depois: 0 })],
  });
const tabela = (cabecalho: string[] | null, linhas: (Trecho[] | string)[][], larguras?: number[]) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      ...(cabecalho ? [new TableRow({ tableHeader: true, children: cabecalho.map((c, i) => celula(c, { negrito: true, fundo: 'E8EDF3', largura: larguras?.[i] })) })] : []),
      ...linhas.map((l) => new TableRow({ children: l.map((c, i) => celula(c, { largura: larguras?.[i] })) })),
    ],
  });
/** Caixa de destaque (uma célula com fundo). */
const caixa = (tituloCaixa: string, paragrafos: Paragraph[], fundo = 'F3F6F9') =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.SINGLE, size: 4, color: '999999' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: '999999' },
      left: { style: BorderStyle.SINGLE, size: 4, color: '999999' }, right: { style: BorderStyle.SINGLE, size: 4, color: '999999' },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' }, insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' } },
    rows: [new TableRow({ children: [new TableCell({
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: fundo },
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      children: [par(tituloCaixa, { bold: true, alinhamento: AlignmentType.LEFT }), ...paragrafos],
    })] })],
  });
const espaco = () => new Paragraph({ children: [] });

const m2 = (x: number | null | undefined) => (x == null ? null : `${num(x)} m²`);
const reais = (x: number | null | undefined) => (x == null ? null : brl(x));
const pct = (a: number) => `${(a * 100).toFixed(2).replace('.', ',')}%`;
const dataBR = (iso: string | null | undefined) => (iso ? iso.split('-').reverse().join('/') : null);
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function enderecoImovel(caso: Caso): Trecho[] {
  const e = caso.imovel.endereco;
  if (!e.logradouro) return [falta('endereço do imóvel')];
  return [t(`${e.logradouro}, nº ${e.numero ?? 's/n'}${e.bairro ? `, ${e.bairro}` : ''}, ${e.municipio ?? ''}/${e.uf ?? ''}${e.cep ? `, CEP ${e.cep}` : ''}`)];
}

function descricaoLaudo(caso: Caso): string | null {
  const l = caso.laudo;
  if (!l) return null;
  const nums = [l.numero_documento, l.id_vistoria].filter((x, i, a) => x && a.indexOf(x) === i);
  return `${l.tipo ? `Laudo de ${l.tipo.replace(/\s*\(.*\)$/, '')}` : 'Laudo de vistoria'}${nums.length ? ` nº ${nums.join(' (vistoria nº ')}${nums.length > 1 ? ')' : ''}` : ''}`;
}

function quadro(linhas: ElementoAvaliado[], cab: string[]): (Table | Paragraph)[] {
  if (!linhas.length) return [par([falta('quadro a montar a partir do laudo — use a análise do laudo no passo 3 do app')])];
  return [tabela(cab, linhas.map((l) => [l.elemento, l.evidencias, l.conclusao]), [22, 48, 30])];
}

export async function gerarRequerimento(caso: Caso, perfil: PerfilMunicipio, hoje = new Date()): Promise<{ buffer: Buffer; lacunas: Lacuna[] }> {
  const pend = lacunas(caso, perfil);
  const sim = simulacaoDoCaso(caso, perfil);
  const c = caso.classificacao, l = caso.lancamento, im = caso.imovel, r = caso.requerente;
  const ref = (k: RefRequerimento) => perfil.requerimento.refs?.[k] ?? `[legislação de ${perfil.nome}]`;
  const ex = l.exercicio ?? perfil.exercicio;
  const laudo = descricaoLaudo(caso);
  const implicito = valorImplicito(caso, perfil);
  const acessorias = c.acessorias ?? [];
  const corpo: (Paragraph | Table)[] = [];

  // ---------------------------------------------------------------- folha de revisão (sai antes de protocolar)
  const porGravidade: [Lacuna['gravidade'], string][] = [['bloqueia', 'Impedem o cálculo'], ['preencher', 'Dados e documentos a fornecer'], ['conferir', 'Pontos a conferir ou decidir']];
  corpo.push(caixa(`RASCUNHO gerado em ${hoje.toLocaleDateString('pt-BR')} — ${pend.length} lacuna(s). REMOVA ESTA CAIXA ANTES DE PROTOCOLAR.`, [
    par('Os trechos em amarelo no texto são lacunas ou pontos a conferir. Resumo:', { alinhamento: AlignmentType.LEFT }),
    ...porGravidade.flatMap(([g, rotulo]) => {
      const itens = pend.filter((x) => x.gravidade === g);
      return itens.length ? [par(`${rotulo} (${itens.length}):`, { bold: true, alinhamento: AlignmentType.LEFT, depois: 40 }),
        ...itens.map((x) => par(`• ${x.texto}`, { alinhamento: AlignmentType.LEFT, depois: 40 }))] : [];
    }),
  ], 'FFF4CC'));
  corpo.push(espaco());

  // ---------------------------------------------------------------- cabeçalho
  corpo.push(...perfil.requerimento.destinatario.map((d) => par(d, { bold: true, alinhamento: AlignmentType.LEFT, depois: 0 })), espaco());
  corpo.push(par(perfil.requerimento.titulo, { bold: true, alinhamento: AlignmentType.CENTER }));
  corpo.push(tabela(null, [
    ['Imóvel', enderecoImovel(caso)],
    ['Inscrição municipal', [ou(im.inscricao, 'inscrição municipal')]],
    ['Código reduzido', [ou(im.codigo_reduzido, 'código reduzido (carnê)')]],
    ['Área do terreno no lançamento', [ou(m2(im.area_terreno_m2), 'área do terreno')]],
    ['Área construída no lançamento', [ou(m2(im.area_construida_m2), 'área construída')]],
    ['Contribuinte / interessado', [ou(r.nome, 'nome')]],
    ['Exercício', [t(String(ex))]],
  ], [35, 65]));

  // ---------------------------------------------------------------- I. requerente
  corpo.push(titulo('I. REQUERENTE'));
  corpo.push(par([
    r.nome ? t(r.nome.toUpperCase(), { bold: true }) : falta('nome do requerente'),
    t(', CPF '), r.cpf && !r.cpf.includes('*') ? t(r.cpf) : falta(r.cpf ? `CPF completo (documentos trazem ${r.cpf})` : 'CPF'),
    t(`, na qualidade de ${r.qualidade ?? 'proprietário'} do imóvel acima identificado, vem, respeitosamente, apresentar IMPUGNAÇÃO AO LANÇAMENTO DO IPTU DO EXERCÍCIO DE ${ex} e requerer a REVISÃO da classificação da construção, do estado de conservação e da memória de cálculo, pelos fundamentos a seguir expostos.`),
  ]));
  corpo.push(par([t('Telefone: '), ou(r.telefone, 'telefone'), t('    E-mail: '), ou(r.email, 'e-mail')], { alinhamento: AlignmentType.LEFT }));

  // ---------------------------------------------------------------- II. síntese
  corpo.push(titulo('II. SÍNTESE DO PEDIDO'));
  corpo.push(par([
    t('O lançamento municipal atribuiu ao imóvel valor venal territorial de '), ou(reais(l.valor_venal_terreno), 'VVT'),
    t(' e valor venal da edificação de '), ou(reais(l.valor_venal_edificacao), 'VVC'),
    t(', totalizando '), ou(reais(l.valor_venal_imovel), 'VVI'), t('. Sobre essa base foi lançado IPTU anual de '), ou(reais(l.iptu_anual), 'IPTU'),
    ...(l.lixo_anual != null ? [t(`, além de ${brl(l.lixo_anual)} de coleta de lixo`)] : []), t('.'),
  ]));
  if (laudo) {
    const lv = caso.laudo!;
    corpo.push(par([
      t(`O ${laudo}`), t(lv.data ? `, realizado em ${dataBR(lv.data)}` : ''),
      t(`, anexo como relatório fotográfico${lv.total_fotos ? ` (${lv.total_fotos} fotos)` : ''}, registra ambiente por ambiente os elementos construtivos do imóvel e seu estado. `),
      c.padrao && c.conservacao
        ? t(`As evidências indicam características predominantes de ${c.tipologia}, padrão ${c.padrao}, em estado de conservação ${c.conservacao}.`)
        : falta('conclusão da classificação (tipologia, padrão e conservação)'),
    ]));
  } else {
    corpo.push(par([falta('descrição das evidências do imóvel (sem laudo de vistoria anexado)')]));
  }
  if (acessorias.length) {
    corpo.push(par([t(`Parte da construção — ${acessorias.map((b) => b.descricao.toLowerCase()).join(', ')} — tem características de outra tipologia e deve ser enquadrada separadamente, com o valor de cada bloco proporcional à sua área.`)]));
  }
  corpo.push(par([
    t('Por isso, requer-se a revisão do Valor Venal da Construção com base no relatório fotográfico anexo, com avaliação expressa do enquadramento '),
    c.padrao ? t(`${c.tipologia} – padrão ${c.padrao}`) : falta('tipologia e padrão'), t(' e do Fator Estado de Conservação '),
    c.conservacao && perfil.fatores_conservacao[c.conservacao] != null ? t(`${c.conservacao}, FC = ${num(perfil.fatores_conservacao[c.conservacao])}`) : falta('estado de conservação'), t('.'),
  ]));
  if (implicito && l.valor_venal_edificacao != null) {
    const fcs = Object.values(perfil.fatores_conservacao).map((f) => num(f)).join(', ');
    const h = implicito.blocos.find((b) => b.padrao === c.padrao && b.conservacao === 'Bom');
    corpo.push(par([
      t(`Requer-se também a memória de cálculo utilizada para chegar ao valor efetivo de ${brl(implicito.efetivo)}/m² de construção, que não corresponde diretamente a nenhum dos coeficientes de conservação (${fcs}) aplicados aos valores do ${ref('valores')}`),
      ...(h ? [t(`. O valor seria compatível, por exemplo, com ${num(h.area_principal)} m² de ${c.tipologia} ${h.padrao} em estado Bom e ${num(h.area_telheiro)} m² de Telheiro ${h.telheiro} — o que indica uma divisão em blocos que não foi informada ao contribuinte`)] : []),
      t('. O carnê não informa tipologia, padrão, conservação nem área por bloco, e o Boletim de Cadastro Imobiliário (BCI) não foi disponibilizado ao contribuinte.'),
    ]));
  }
  if (caso.laudo?.area_util_m2 && im.area_construida_m2) {
    corpo.push(caixa('Ressalva sobre a metragem', [par(`O laudo informa área útil de ${num(caso.laudo.area_util_m2)} m², enquanto o cadastro considera ${num(im.area_construida_m2)} m² de área construída. Como os conceitos não são necessariamente equivalentes e o laudo não contém croqui cotado, o presente pedido não afirma erro de metragem. Solicita a confirmação do critério de medição e a discriminação da área de cada bloco da construção.`)]));
  }

  // ---------------------------------------------------------------- III. fatos
  corpo.push(titulo('III. FATOS E EVIDÊNCIAS'));
  corpo.push(subtitulo('3.1. Características construtivas'));
  corpo.push(...quadro(c.caracteristicas, ['Elemento', `Evidências${laudo ? ` do ${laudo}` : ''}`, 'Enquadramento preliminar']));
  corpo.push(subtitulo('3.2. Estado de conservação'));
  corpo.push(...quadro(c.estado, ['Elemento', 'Condição observada', 'Conclusão']));
  corpo.push(subtitulo('3.3. Classificação por bloco (ambiente)'));
  if (acessorias.length) {
    corpo.push(par('Propõe-se classificar a construção por bloco, com o valor de cada um proporcional à sua área:'));
    const areaAcess = acessorias.reduce((s, b) => s + (b.area_m2 ?? 0), 0);
    const principal = im.area_construida_m2 != null && acessorias.every((b) => b.area_m2) ? m2(im.area_construida_m2 - areaAcess) : null;
    corpo.push(tabela(['Bloco', 'Ambientes do laudo', 'Enquadramento', 'Área'], [
      ['Corpo principal', 'demais ambientes', `${c.tipologia ?? '?'} ${c.padrao ?? '?'}, ${c.conservacao ?? '?'}`, [ou(principal, 'área restante')]],
      ...acessorias.map((b) => [b.descricao, b.ambientes ?? '—', `${b.tipologia} ${b.padrao}, ${b.conservacao}`, [ou(m2(b.area_m2), `área de ${b.descricao.toLowerCase()}`)]] as (Trecho[] | string)[]),
    ], [22, 30, 30, 18]));
  } else if (c.areas_acessorias) {
    corpo.push(par(c.areas_acessorias));
  } else {
    corpo.push(par('Não foram identificadas áreas a enquadrar separadamente do corpo principal.'));
  }

  // ---------------------------------------------------------------- IV. fundamentação
  corpo.push(titulo('IV. FUNDAMENTAÇÃO LEGAL'));
  if (perfil.requerimento.fundamentacao?.length) corpo.push(...perfil.requerimento.fundamentacao.map((p) => par(p)));
  else corpo.push(par([falta(`fundamentação legal de ${perfil.nome}`)]));

  // ---------------------------------------------------------------- V e VI. quadro e memória
  corpo.push(titulo('V. QUADRO COMPARATIVO'));
  if (sim) corpo.push(quadroComparativo(caso, sim, implicito?.efetivo ?? null));
  else corpo.push(par([falta('quadro comparativo — falta classificar o imóvel ou os valores do lançamento')]));
  corpo.push(titulo('VI. MEMÓRIA DA SIMULAÇÃO'));
  if (sim) {
    corpo.push(par(`A simulação utiliza a área municipal de ${num(sim.cenario.area_m2)} m², sem reconhecer definitivamente sua correção, e mantém o valor venal do terreno lançado:`));
    corpo.push(...sim.memoria.map((m) => par(m, { bold: true, alinhamento: AlignmentType.LEFT })));
    corpo.push(caixa('Natureza da simulação', [par('Os valores acima demonstram o efeito do enquadramento solicitado. O lançamento definitivo deverá resultar da análise do relatório fotográfico, da classificação por bloco e da memória de cálculo oficial.')]));
  } else {
    corpo.push(par([falta('memória de cálculo')]));
  }

  // ---------------------------------------------------------------- VII. pedidos
  corpo.push(titulo('VII. PEDIDOS'));
  const pedidos: Trecho[][] = [
    [t(`o recebimento deste requerimento como impugnação tempestiva do lançamento do IPTU do exercício de ${ex}, nos termos do ${ref('contraditorio')}, com efeitos sobre o próprio exercício, conforme a ressalva do ${ref('efeito')}; e, subsidiariamente, como pedido de revisão cadastral com efeitos a partir do exercício de ${ex + 1}, inclusive para a emissão de certidão de valor venal e como referência em futuras transmissões do imóvel;`)],
    [t('o fornecimento do BCI, da ficha cadastral e da memória integral do lançamento, com a tipologia, o padrão, a área de cada bloco, o valor unitário e o fator de conservação utilizados;')],
    [t(`a análise do relatório fotográfico anexo${laudo ? ` — ${laudo} —` : ''} como prova do estado do imóvel e, somente se a Administração entender indispensável, a realização de vistoria, com comunicação prévia ao requerente;`)],
    [t('a avaliação do corpo principal da construção como '), c.padrao ? t(`${c.tipologia}, padrão ${c.padrao}`) : falta('tipologia e padrão'), t(`, à luz dos ${ref('padrao')};`)],
    [t('a avaliação do estado de conservação como '), c.conservacao ? t(`${c.conservacao}, com FC = ${num(perfil.fatores_conservacao[c.conservacao] ?? NaN)}`) : falta('estado de conservação'), t(`, conforme ${ref('conservacao')};`)],
    acessorias.length
      ? [t('a individualização cadastral e o enquadramento separado de '),
        ...acessorias.flatMap((b, i) => [t(`${i ? (i === acessorias.length - 1 ? ' e ' : ', ') : ''}${b.descricao.toLowerCase()} como ${b.tipologia} ${b.padrao}, estado ${b.conservacao} (`), ou(m2(b.area_m2), 'área'), t(')')]),
        t(', com o valor de cada bloco proporcional à sua área;')]
      : [t('a individualização cadastral da garagem, da área de serviço e de outras coberturas, classificando-as conforme a tipologia e o padrão efetivamente observados, inclusive Telheiro, se cabível;')],
    [t(`a confirmação do critério de medição dos ${num(im.area_construida_m2 ?? NaN)} m² e a apresentação do croqui ou polígono cadastral utilizado;`)],
    [t('o recálculo do Valor Venal da Construção e do Valor Venal Total;')],
    sim
      ? [t(`caso confirmado o enquadramento acima, o recálculo do VVC para ${brl(sim.revisado.valor_venal_edificacao)}, do VVI para ${brl(sim.revisado.valor_venal_imovel)} e do IPTU para ${brl(sim.revisado.iptu_anual)};`)]
      : [falta('valores do recálculo (VVC, VVI e IPTU)')],
    ...(sim && sim.atual && sim.atual.faixa.aliquota !== sim.revisado.faixa.aliquota
      ? [[t(`a revisão da faixa de alíquota para ${pct(sim.revisado.faixa.aliquota)} (${sim.revisado.faixa.ref}), se confirmado o valor venal total revisado;`)]]
      : []),
    [t('a emissão de novo BCI, nova certidão de valor venal e novo demonstrativo do IPTU;')],
    [t('o cancelamento das diferenças indevidas e a restituição ou compensação dos valores pagos a maior, se houver;')],
    [t('a concessão de prazo para juntada de levantamento dimensional, laudo complementar e ART/RRT, caso considerados necessários;')],
    [t('na hipótese de indeferimento total ou parcial, a emissão de decisão expressamente motivada, com indicação dos fatos, critérios, documentos, fórmulas e dispositivos legais utilizados.')],
  ];
  corpo.push(...pedidos.map((p, i) => par([t(`${i + 1}. `), ...p])));

  // ---------------------------------------------------------------- VIII. anexos
  corpo.push(titulo('VIII. DOCUMENTOS ANEXOS'));
  const anexos = [
    'Documento de identidade e CPF do requerente;',
    `Carnê / cobrança do IPTU de ${ex};`,
    ...(laudo ? [`${laudo}, como relatório fotográfico;`] : []),
    'Comprovante de vínculo com o imóvel (matrícula ou escritura);',
    'Procuração, se aplicável;',
  ];
  corpo.push(...anexos.map((a) => par(`☐ ${a}`, { alinhamento: AlignmentType.LEFT, depois: 40 })));
  corpo.push(par([t('☐ Outros: '), falta('outros documentos, se houver')], { alinhamento: AlignmentType.LEFT }));

  // ---------------------------------------------------------------- IX. assinatura
  corpo.push(titulo('IX. DECLARAÇÃO E ASSINATURA'));
  corpo.push(par('O requerente declara que as informações apresentadas correspondem aos documentos disponíveis e compromete-se a complementar a instrução, se solicitado.'));
  corpo.push(par([t(`${perfil.nome}, `), falta('dia'), t(' de '), falta('mês'), t(` de ${hoje.getFullYear()}.`)], { alinhamento: AlignmentType.LEFT }));
  corpo.push(espaco(), espaco());
  corpo.push(par('_______________________________________________', { alinhamento: AlignmentType.CENTER, depois: 0 }));
  corpo.push(par([r.nome ? t(r.nome.toUpperCase(), { bold: true }) : falta('nome')], { alinhamento: AlignmentType.CENTER, depois: 0 }));
  corpo.push(par([t('CPF: '), r.cpf && !r.cpf.includes('*') ? t(r.cpf) : falta('CPF')], { alinhamento: AlignmentType.CENTER }));

  const doc = new Document({
    creator: 'app de revisão de IPTU',
    title: perfil.requerimento.titulo,
    styles: {
      default: { document: { run: { font: 'Arial', size: 21 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', run: { bold: true, size: 24, color: '1F3B5C' } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', run: { bold: true, size: 22 } },
      ],
    },
    sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1418, right: 1134 } } }, children: corpo }],
  });
  return { buffer: await Packer.toBuffer(doc), lacunas: pend };
}

function quadroComparativo(caso: Caso, s: Simulacao, efetivoAtual: number | null): Table {
  const l = caso.lancamento, im = caso.imovel;
  const red = (d: number | null) => (d == null ? '' : d >= 0 ? `Redução simulada de ${brl(d)}.` : `AUMENTO de ${brl(-d)}.`);
  const cl = caso.classificacao;
  const v = (x: number | null | undefined) => (x == null ? '—' : brl(x));
  return tabela(['Item', 'Lançamento municipal', 'Revisão requerida / simulação', 'Observação'], [
    ['Área do terreno', m2(im.area_terreno_m2) ?? '—', 'Mantida', 'Sem contestação neste pedido.'],
    ['Valor venal do terreno', v(l.valor_venal_terreno), 'Mantido provisoriamente', 'Solicita-se apenas a memória dos fatores do terreno.'],
    ['Área da construção', m2(im.area_construida_m2) ?? '—', s.blocos.length > 1 ? s.blocos.map((b) => `${b.descricao}: ${num(b.area_m2)} m²`).join('; ') : 'A confirmar', caso.laudo?.area_util_m2 ? `Laudo informa ${num(caso.laudo.area_util_m2)} m² de área útil; conceitos distintos.` : ''],
    ['Tipologia e padrão', im.tipo_cadastro ? `${im.tipo_cadastro} (padrão não informado)` : 'Não informado', s.blocos.map((b) => `${b.tipologia} ${b.padrao}`).join(' + '), cl.acessorias?.length ? 'Classificação por bloco.' : ''],
    ['Estado de conservação', 'Não informado na cobrança', s.blocos.map((b) => b.conservacao).filter((x, i, a) => a.indexOf(x) === i).join(' / '), `FC = ${s.blocos.map((b) => num(b.fator_conservacao)).filter((x, i, a) => a.indexOf(x) === i).join(' / ')}`],
    ['Valor efetivo da construção', efetivoAtual != null ? `${brl(efetivoAtual)}/m²` : '—', `${brl(s.revisado.valor_venal_edificacao / s.cenario.area_m2)}/m² (média)`, `${s.cenario.tipologia} ${s.cenario.padrao}: ${brl(s.valor_m2_tabela)} × ${num(s.fator_conservacao)}`],
    ['Valor venal da construção', v(l.valor_venal_edificacao), brl(s.revisado.valor_venal_edificacao), ''],
    ['Valor venal total', v(l.valor_venal_imovel), brl(s.revisado.valor_venal_imovel), red(s.reducao_vvi)],
    ['Alíquota do IPTU', s.atual ? pct(s.atual.faixa.aliquota) : '—', pct(s.revisado.faixa.aliquota), s.revisado.faixa.ref],
    ['IPTU anual', v(l.iptu_anual), brl(s.revisado.iptu_anual), red(s.reducao_iptu)],
    ['Coleta de lixo', v(l.lixo_anual), s.revisado.lixo_anual != null ? brl(s.revisado.lixo_anual) : 'Mantida', 'Calculada sobre a área construída.'],
    ['Total anual', v(l.total_lancado), brl(s.revisado.total), red(s.reducao_total)],
  ], [22, 22, 26, 30]);
}

/** Nome de arquivo do rascunho. */
export const nomeRequerimento = (caso: Caso) => `requerimento_iptu_${(caso.imovel.inscricao ?? 'rascunho').replace(/[^\w-]+/g, '_')}.docx`;
