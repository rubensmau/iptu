// Campos que a tela mostra e deixa editar, com rótulo e tipo.
export type Campo = { caminho: string; rotulo: string; tipo: 'texto' | 'inteiro' | 'numero' | 'reais'; obrigatorio?: boolean }

export const GRUPOS: { titulo: string; campos: Campo[] }[] = [
  {
    titulo: 'Requerente',
    campos: [
      { caminho: 'requerente.nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true },
      { caminho: 'requerente.cpf', rotulo: 'CPF/CNPJ', tipo: 'texto', obrigatorio: true },
      { caminho: 'requerente.qualidade', rotulo: 'Qualidade', tipo: 'texto' },
      { caminho: 'requerente.telefone', rotulo: 'Telefone', tipo: 'texto', obrigatorio: true },
      { caminho: 'requerente.email', rotulo: 'E-mail', tipo: 'texto', obrigatorio: true },
    ],
  },
  {
    titulo: 'Imóvel',
    campos: [
      { caminho: 'imovel.endereco.logradouro', rotulo: 'Logradouro', tipo: 'texto', obrigatorio: true },
      { caminho: 'imovel.endereco.numero', rotulo: 'Número', tipo: 'texto', obrigatorio: true },
      { caminho: 'imovel.endereco.bairro', rotulo: 'Bairro', tipo: 'texto' },
      { caminho: 'imovel.endereco.municipio', rotulo: 'Município', tipo: 'texto', obrigatorio: true },
      { caminho: 'imovel.endereco.uf', rotulo: 'UF', tipo: 'texto' },
      { caminho: 'imovel.endereco.cep', rotulo: 'CEP', tipo: 'texto' },
      { caminho: 'imovel.inscricao', rotulo: 'Inscrição municipal', tipo: 'texto', obrigatorio: true },
      { caminho: 'imovel.codigo_reduzido', rotulo: 'Código reduzido', tipo: 'texto' },
      { caminho: 'imovel.tipo_cadastro', rotulo: 'Tipo no cadastro', tipo: 'texto' },
      { caminho: 'imovel.zona_pgv', rotulo: 'Zona / PGV', tipo: 'texto' },
      { caminho: 'imovel.testada_m', rotulo: 'Testada (m)', tipo: 'numero' },
      { caminho: 'imovel.area_terreno_m2', rotulo: 'Área do terreno (m²)', tipo: 'numero', obrigatorio: true },
      { caminho: 'imovel.area_construida_m2', rotulo: 'Área construída (m²)', tipo: 'numero', obrigatorio: true },
    ],
  },
  {
    titulo: 'Lançamento',
    campos: [
      { caminho: 'lancamento.exercicio', rotulo: 'Exercício', tipo: 'inteiro', obrigatorio: true },
      { caminho: 'lancamento.valor_venal_terreno', rotulo: 'Valor venal do terreno', tipo: 'reais', obrigatorio: true },
      { caminho: 'lancamento.valor_venal_edificacao', rotulo: 'Valor venal da edificação', tipo: 'reais', obrigatorio: true },
      { caminho: 'lancamento.valor_venal_imovel', rotulo: 'Valor venal total', tipo: 'reais' },
      { caminho: 'lancamento.iptu_anual', rotulo: 'IPTU anual', tipo: 'reais', obrigatorio: true },
      { caminho: 'lancamento.lixo_anual', rotulo: 'Coleta de lixo anual', tipo: 'reais' },
      { caminho: 'lancamento.total_lancado', rotulo: 'Total lançado', tipo: 'reais' },
      { caminho: 'lancamento.parcelas', rotulo: 'Parcelas', tipo: 'inteiro' },
    ],
  },
]

export const ROTULO_FONTE: Record<string, string> = {
  laudo: 'laudo', carne: 'carnê', bci: 'BCI', legislacao: 'lei', julgamento: 'sugestão', calculo: 'cálculo', usuario: 'você',
}

export function pega(obj: unknown, caminho: string): unknown {
  return caminho.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj)
}

/** Cópia do objeto com o valor trocado no caminho. */
export function poe<T>(obj: T, caminho: string, valor: unknown): T {
  const [k, ...resto] = caminho.split('.')
  const atual = (obj as Record<string, unknown>)[k]
  return { ...obj, [k]: resto.length ? poe(atual ?? {}, resto.join('.'), valor) : valor } as T
}
