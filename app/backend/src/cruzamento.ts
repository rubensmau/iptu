// Junta o que cada extrator tirou num único Caso, conferindo um documento
// contra o outro. Para dados cadastrais vale o carnê (é o que a prefeitura tem);
// o laudo completa o que falta (CEP, CPF) e traz a descrição do imóvel.
import { comparaMercado, mesAno } from './mercado.js';
import type { Caso, Extracao, Fonte, Laudo, Registro } from './tipos.js';

// palavras que indicam defeito numa observação cujo título diz "em bom estado"
const DEFEITO = /trinca|rachadura|ferrugem|quebrad|bolor|umidade|vazamento|mau estado|podre|faltando|faltante|danificad|queimad|emperrad|espanad|soltando|estufad|infiltra/i;

/** Alertas que valem para qualquer laudo, venha do extrator ou da leitura por IA. */
export function alertasLaudo(laudo: Laudo): string[] {
  const out: string[] = [];
  const itens = laudo.ambientes.flatMap((a) => a.observacoes);
  const contraditorios = itens.filter((o) => /em bom estado/i.test(o.split('Obs:')[0]) && DEFEITO.test(o.split('Obs:')[1] ?? ''));
  if (contraditorios.length) {
    out.push(`Laudo: ${contraditorios.length} de ${itens.length} itens vêm como "em bom estado", mas as observações descrevem defeitos. Citar as observações, não o título do item.`);
  }
  if (/entrada|saída|saida|loca/i.test(`${laudo.tipo ?? ''}`)) {
    out.push('Laudo de vistoria de locação, sem ART nem croqui: serve como relatório fotográfico do estado do imóvel (o pedido não depende dele), mas a área útil não equivale necessariamente à área construída do cadastro.');
  }
  return out;
}

const PRIORIDADE: Fonte[] = ['carne', 'bci', 'laudo', 'usuario', 'registro'];

/** "Maurício  Costa Porto" ~ "MAURICIO COSTA PORTO" */
export const normaliza = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().replace(/\s+/g, ' ').trim();

const reais = (x: number) => x.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const m2 = (x: number) => `${x.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
const digitos = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');
/** "Herminio Cecato" ~ "RUA HERMINIO CECATTO": sem tipo de via, acentos nem letras dobradas. */
const logradouroChave = (s: string) => normaliza(s).replace(/^(RUA|R\.|AVENIDA|AV\.?|TRAVESSA|ESTRADA|ALAMEDA|PRACA|RODOVIA)\s+/, '')
  .replace(/[^A-Z0-9]/g, '').replace(/(.)\1+/g, '$1');

/**
 * Confere o caso (montado do carnê e do laudo) contra a matrícula/escritura.
 * Não altera nada: devolve alertas, inclusive um resumo do que confere.
 */
export function conferirRegistro(caso: Caso, reg: Registro): string[] {
  const out: string[] = [];
  const confere: string[] = [];
  const doc = `Matrícula${reg.matricula ? ` nº ${reg.matricula}` : '/escritura'}`;
  const r = caso.requerente, im = caso.imovel;

  // titulares
  if (reg.proprietarios.length) {
    const titular = reg.proprietarios.find((p) =>
      (r.cpf && p.cpf && digitos(r.cpf) === digitos(p.cpf)) || (r.nome && p.nome && normaliza(r.nome) === normaliza(p.nome)));
    const nomes = reg.proprietarios.map((p) => p.nome).join(', ');
    if (!r.nome) out.push(`${doc}: titulares atuais ${nomes}; o requerente ainda não foi informado.`);
    else if (!titular) out.push(`${doc}: o requerente ${r.nome} não aparece entre os titulares atuais (${nomes}). Quem não é titular precisa de procuração ou de outro vínculo (posse, compromisso de compra).`);
    else {
      confere.push('titular');
      if (r.cpf && titular.cpf && digitos(r.cpf) !== digitos(titular.cpf)) out.push(`${doc}: CPF do requerente (${r.cpf}) diverge do registro (${titular.cpf}).`);
      const outros = reg.proprietarios.filter((p) => p !== titular);
      if (outros.length) out.push(`${doc}: o imóvel também é de ${outros.map((p) => p.nome).join(', ')}. Considere incluir no requerimento ou anexar autorização.`);
    }
  }
  // inscrição: a matrícula costuma citar só a parte do lote ("81-38-25-0102" × "81-38-25-0102-001")
  const ic = digitos(reg.inscricao_cadastral), ii = digitos(im.inscricao);
  if (ic && ii) {
    if (ii.startsWith(ic) || ic.startsWith(ii)) confere.push('inscrição');
    else out.push(`${doc}: inscrição cadastral ${reg.inscricao_cadastral} diverge da do carnê (${im.inscricao}). Pode ser cadastro antigo; conferir na Prefeitura.`);
  }
  // endereço
  const e = reg.endereco, ec = im.endereco;
  if (e.logradouro && ec.logradouro) {
    const mesmoLogr = logradouroChave(e.logradouro) === logradouroChave(ec.logradouro);
    const mesmoNum = !e.numero || !ec.numero || digitos(e.numero) === digitos(ec.numero);
    if (mesmoLogr && mesmoNum) confere.push('endereço');
    else out.push(`${doc}: endereço "${e.logradouro}${e.numero ? `, ${e.numero}` : ''}" diverge do carnê ("${ec.logradouro}${ec.numero ? `, ${ec.numero}` : ''}").`);
  }
  // área do terreno
  if (reg.area_terreno_m2 && im.area_terreno_m2) {
    const dif = Math.abs(reg.area_terreno_m2 - im.area_terreno_m2) / reg.area_terreno_m2;
    if (dif <= 0.01) confere.push('área do terreno');
    else out.push(`${doc}: área do terreno ${m2(reg.area_terreno_m2)} no registro × ${m2(im.area_terreno_m2)} no cadastro. Se o cadastro estiver maior, o valor do terreno está superestimado.`);
  }
  // construção: o registro raramente acompanha as reformas
  if (reg.area_construida_m2 && im.area_construida_m2) {
    const dif = (im.area_construida_m2 - reg.area_construida_m2) / reg.area_construida_m2;
    if (Math.abs(dif) <= 0.02) confere.push('área construída');
    else out.push(`${doc}: área construída averbada ${m2(reg.area_construida_m2)} × ${m2(im.area_construida_m2)} no cadastro (${(dif * 100).toFixed(1).replace('.', ',')}%). Vale pedir o croqui cadastral.`);
  } else if (im.area_construida_m2 && reg.descricao_construcao) {
    out.push(`${doc}: não há área construída averbada; o registro descreve a construção como "${reg.descricao_construcao}". A área de ${m2(im.area_construida_m2)} vem só do cadastro municipal.`);
  }
  // preço pago (corrigido pelo IPCA) × valor venal lançado
  const t = reg.transacao, vvi = caso.lancamento.valor_venal_imovel;
  const ano = t?.data?.slice(0, 4);
  const cmp = comparaMercado({ ...caso, registro: reg });
  if (cmp && cmp.excesso > 0) {
    out.push(`${doc}: o valor venal lançado (${reais(cmp.valor_venal)}) supera em ${(cmp.excesso * 100).toFixed(1).replace('.', ',')}% o preço pago em ${ano} ` +
      `(${reais(cmp.preco)}, ou ${reais(cmp.preco_corrigido)} corrigido pelo IPCA até ${mesAno(cmp.mes_ate)}). O requerimento inclui o argumento de valor de mercado.`);
  } else if (cmp) {
    out.push(`${doc}: preço pago em ${ano} corrigido pelo IPCA (${reais(cmp.preco_corrigido)}) não fica abaixo do valor venal lançado (${reais(cmp.valor_venal)}): sem argumento de valor de mercado.`);
  } else if (t?.valor && vvi && !t.data) {
    out.push(`${doc}: preço pago de ${reais(t.valor)} sem data legível: não deu para corrigir pelo IPCA.`);
  }
  if (t?.valor_venal_declarado && vvi) out.push(`${doc}: a escritura${ano ? ` de ${ano}` : ''} cita valor venal de ${reais(t.valor_venal_declarado)}, contra ${reais(vvi)} lançados agora.`);
  if (confere.length) out.push(`${doc} confere com o carnê em: ${confere.join(', ')}.`);
  return out;
}

export function casoVazio(municipio: string): Caso {
  return {
    municipio,
    requerente: { nome: null, cpf: null, telefone: null, email: null, qualidade: null },
    imovel: {
      endereco: { logradouro: null, numero: null, bairro: null, municipio: null, uf: null, cep: null },
      inscricao: null, codigo_reduzido: null, tipo_cadastro: null, zona_pgv: null, testada_m: null,
      area_terreno_m2: null, area_construida_m2: null, area_ideal_m2: null,
    },
    lancamento: {
      exercicio: null, valor_venal_terreno: null, valor_venal_edificacao: null, valor_venal_imovel: null,
      iptu_anual: null, lixo_anual: null, total_lancado: null, parcelas: null,
      imposto_territorial_mensal: null, imposto_predial_mensal: null, lixo_mensal: null, lixo_valor_m2: null,
    },
    laudo: null,
    registro: null,
    classificacao: {
      tipologia: null, padrao: null, conservacao: null, caracteristicas: [], estado: [],
      areas_acessorias: null, acessorias: [], confianca: null, pontos_fracos: [],
    },
    anexos: [],
    confirmacoes: [],
    origens: {},
    alertas: [],
  };
}

export function montarCaso(municipio: string, extracoes: Extracao[]): Caso {
  const caso = casoVazio(municipio);
  const ordem = [...extracoes].sort((a, b) => PRIORIDADE.indexOf(a.fonte) - PRIORIDADE.indexOf(b.fonte));

  // preenche cada grupo campo a campo; o primeiro na ordem de prioridade ganha
  const grupos = [
    ['requerente', caso.requerente, (e: Extracao) => e.requerente],
    ['imovel.endereco', caso.imovel.endereco, (e: Extracao) => e.endereco],
    ['imovel', caso.imovel, (e: Extracao) => e.imovel],
    ['lancamento', caso.lancamento, (e: Extracao) => e.lancamento],
  ] as const;
  for (const [prefixo, alvo, pega] of grupos) {
    const destino = alvo as unknown as Record<string, unknown>;
    for (const ext of ordem) {
      for (const [campo, valor] of Object.entries(pega(ext))) {
        if (valor == null || typeof valor === 'object') continue;
        const chave = `${prefixo}.${campo}`;
        const atual = destino[campo];
        if (atual == null) {
          destino[campo] = valor;
          if (ext.origens[chave]) caso.origens[chave] = ext.origens[chave];
        } else if (normaliza(String(atual)) === normaliza(String(valor))) {
          // mesmo valor; prefere a grafia com acentos à do carnê, toda em maiúsculas
          if (typeof valor === 'string' && atual === String(atual).toUpperCase() && valor !== valor.toUpperCase()) {
            destino[campo] = valor;
          }
        } else {
          const o = caso.origens[chave];
          caso.origens[chave] = { ...o, fonte: o?.fonte ?? 'usuario', valor_original: `${o?.valor_original ?? atual}; ${ext.documento}: ${valor}` };
          caso.alertas.push(`${chave}: "${atual}" (${o?.fonte}) diverge de "${valor}" (${ext.documento}). Usado o primeiro.`);
        }
      }
    }
  }

  const laudo = ordem.find((e) => e.laudo)?.laudo ?? null;
  caso.laudo = laudo;
  caso.registro = ordem.find((e) => e.registro)?.registro ?? null;
  const cep = caso.imovel.endereco.cep?.replace(/\D/g, '');
  if (cep?.length === 8) caso.imovel.endereco.cep = `${cep.slice(0, 5)}-${cep.slice(5)}`;
  caso.requerente.qualidade ??= caso.requerente.nome ? 'proprietário' : null;
  for (const ext of ordem) {
    for (const [k, o] of Object.entries(ext.origens)) if (k.startsWith('laudo.')) caso.origens[k] ??= o;
    caso.alertas.push(...ext.alertas);
  }
  if (laudo) caso.alertas.push(...alertasLaudo(laudo));
  if (caso.registro) caso.alertas.push(...conferirRegistro(caso, caso.registro));
  if (laudo?.categoria) {
    caso.classificacao.tipologia = caso.imovel.tipo_cadastro ?? laudo.categoria;
    caso.origens['classificacao.tipologia'] = { fonte: 'julgamento', ref: `cadastro: ${caso.imovel.tipo_cadastro ?? '?'}; laudo: ${laudo.categoria}` };
  }

  // área útil (laudo) × área construída (cadastro)
  const util = laudo?.area_util_m2, construida = caso.imovel.area_construida_m2;
  if (util && construida) {
    const dif = ((util - construida) / construida) * 100;
    caso.alertas.push(`Área: laudo ${util.toFixed(2)} m² (útil) × cadastro ${construida.toFixed(2)} m² (construída), diferença de ${dif.toFixed(1)}%. ` +
      (Math.abs(dif) > 5 ? 'Diferença relevante — vale pedir o croqui cadastral.' : 'Conceitos diferentes; não afirmar erro de metragem.'));
  }
  return caso;
}
