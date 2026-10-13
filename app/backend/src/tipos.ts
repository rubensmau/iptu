// Modelo de dados do pedido de revisão de IPTU.
//
// Separa o que é fixo de cada prefeitura (PerfilMunicipio, em municipios/*.json)
// do que é de cada imóvel (Caso, em casos/*.json). Cada campo do caso registra
// de onde veio (Origem), para a tela mostrar ao proprietário o que foi extraído,
// calculado, sugerido ou ainda falta.
//
// Valores em reais e m² são `number`; o arredondamento fica no cálculo (calc.ts).

export type Fonte =
  | 'laudo'       // laudo de vistoria (ex.: MSYS)
  | 'carne'       // carnê / documento de arrecadação do IPTU
  | 'bci'         // boletim de cadastro imobiliário / ficha cadastral
  | 'legislacao'  // perfil do município
  | 'julgamento'  // classificação sugerida, revisada pelo proprietário
  | 'calculo'
  | 'usuario';    // digitado pelo proprietário

export interface Origem {
  fonte: Fonte;
  ref?: string;            // página, rótulo do carnê, artigo...
  valor_original?: string; // como aparecia na fonte, quando diverge do usado
}

// ---------------------------------------------------------------- município

export interface Norma {
  id: string;     // chave usada nas citações, ex.: "lc392"
  tipo: string;   // "Lei Complementar", "Lei"
  numero: string;
  ano: number;
  descricao: string;
  artigos: Record<string, string>; // "art. 5º, II" -> resumo do que diz
}

export interface FaixaAliquota {
  ate: number | null; // limite superior do valor venal; null = sem limite
  aliquota: number;   // fração: 0.0035 = 0,35%
  ref: string;
}

export interface PadraoConstrutivo {
  valor_m2: number | null;   // null = ainda não levantado
  descricao: string | null;  // características do padrão (Anexo IV)
}

export interface Tributacao {
  parcelas: number;
  // o carnê de Mogi Mirim arredonda cada parcela mensal; o anual é parcela × n
  arredondamento: 'por_parcela' | 'anual';
  faixas_predial: FaixaAliquota[];
  lixo_valor_m2: number | null;
  ref_lixo: string | null;
}

export interface PerfilMunicipio {
  id: string;
  nome: string;
  uf: string;
  exercicio: number;
  fonte_dados: string; // de onde os números deste perfil foram tirados
  normas: Norma[];
  formula_vvc: string;
  ref_formula_vvc: string;
  // tipologia -> padrão -> valor/descrição (Anexos II e IV)
  valores_construcao: Record<string, Record<string, PadraoConstrutivo>>;
  fatores_conservacao: Record<string, number>; // Bom/Regular/Mau
  ref_fatores_conservacao: string;
  tributacao: Tributacao;
  requerimento: {
    destinatario: string[]; // linhas do cabeçalho
    titulo: string;
    template: string | null; // .docx modelo
  };
  pendencias: string[]; // o que falta levantar no perfil
}

// ---------------------------------------------------------------- caso

export interface Pessoa {
  nome: string | null;
  cpf: string | null;
  telefone?: string | null;
  email?: string | null;
  qualidade?: string | null; // proprietário, possuidor, procurador...
}

export interface Endereco {
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
}

export interface Imovel {
  endereco: Endereco;
  inscricao: string | null;
  codigo_reduzido: string | null;
  tipo_cadastro: string | null; // "Prédio / Tipo" no carnê
  zona_pgv: string | null;
  testada_m: number | null;
  area_terreno_m2: number | null;
  area_construida_m2: number | null;
  area_ideal_m2: number | null;
}

export interface Lancamento {
  exercicio: number | null;
  valor_venal_terreno: number | null;
  valor_venal_edificacao: number | null;
  valor_venal_imovel: number | null;
  iptu_anual: number | null;
  lixo_anual: number | null;
  total_lancado: number | null;
  parcelas: number | null;
  imposto_territorial_mensal: number | null;
  imposto_predial_mensal: number | null;
  lixo_mensal: number | null;
  lixo_valor_m2: number | null;
}

export interface Ambiente {
  numero: number;
  nome: string;
  observacoes: string[]; // texto literal do laudo, item a item
}

export interface Laudo {
  tipo: string | null;             // "Vistoria de Entrada (locação)"
  categoria: string | null;        // "Casa", "Apartamento"... (como o laudo diz)
  sistema: string | null;          // "MSYS"
  numero_documento: string | null; // número no título do PDF
  id_vistoria: string | null;      // id interno (link/QR code)
  data: string | null;             // AAAA-MM-DD
  cidade_emissao: string | null;
  vistoriador: Pessoa | null;
  area_util_m2: number | null;
  total_fotos: number | null;
  paginas: number | null;
  observacoes_gerais: string[]; // texto solto, fora dos ambientes
  ambientes: Ambiente[];
}

export interface ElementoAvaliado {
  elemento: string;
  evidencias: string;
  conclusao: string;
}

export interface Classificacao {
  tipologia: string | null;
  padrao: string | null;
  conservacao: string | null;
  caracteristicas: ElementoAvaliado[]; // quadro 3.1 do requerimento
  estado: ElementoAvaliado[];          // quadro 3.2
  areas_acessorias: string | null;     // garagem, área de serviço → Telheiro?
  confianca: 'alta' | 'media' | 'baixa' | null;
  pontos_fracos: string[]; // o que a prefeitura pode usar contra o pedido
}

/**
 * Pergunta que a tela faz ao proprietário sobre um critério subjetivo
 * (estado, padrão, áreas acessórias...). A sugestão vem do modelo; vale a resposta.
 */
export interface Confirmacao {
  id: string;            // "conservacao", "padrao", "garagem"...
  campo: string | null;  // caminho no Caso que a resposta altera
  pergunta: string;
  opcoes: string[];
  sugestao: string;      // uma das opções
  justificativa: string; // evidências do laudo, com o ambiente
  impacto: string | null; // efeito no IPTU, quando calculável
  resposta: string | null; // preenchida pela tela
}

export interface Caso {
  municipio: string; // id do PerfilMunicipio
  requerente: Pessoa;
  imovel: Imovel;
  lancamento: Lancamento;
  laudo: Laudo | null;
  classificacao: Classificacao;
  anexos: string[];
  confirmacoes: Confirmacao[];
  // caminho com ponto ("imovel.area_construida_m2") -> origem do valor
  origens: Record<string, Origem>;
  alertas: string[];
}

// ---------------------------------------------------------------- extração

/** O que um extrator conseguiu tirar de um documento; o cruzamento junta várias. */
export interface Extracao {
  fonte: Fonte;
  documento: string; // ex.: "carnê IPTU Mogi Mirim", "laudo MSYS"
  requerente: Partial<Pessoa>;
  endereco: Partial<Endereco>;
  imovel: Partial<Omit<Imovel, 'endereco'>>;
  lancamento: Partial<Lancamento>;
  laudo: Laudo | null;
  origens: Record<string, Origem>;
  alertas: string[];
}
