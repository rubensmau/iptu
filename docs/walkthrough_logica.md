# Walkthrough da lógica do backend

Conversa de 2026-10-14 sobre o código de `app/backend/src`, focada na lógica e não na tela.

- [1. Walkthrough das funções de lógica](#1-walkthrough-das-funções-de-lógica)
- [2. A extração de PDF é por IA?](#2-a-extração-de-pdf-é-por-ia)
- [3. O que é o laudo MSYS?](#3-o-que-é-o-laudo-msys)

---

## 1. Walkthrough das funções de lógica

> **Pergunta:** gostaria que me fizesse um code walkthrough das funções de lógica; sobre UI estou menos interessado.

O fluxo é um pipeline em quatro estágios. Cada estágio tem um módulo e uma estrutura de dados própria:

```
PDF ──► extrair/ ──► Extracao ──► cruzamento.ts ──► Caso ──► classificar.ts (IA) ──► Confirmações
                                                         └─► calc.ts ──► Simulacao / cenários
                     municipios/*.json ──► PerfilMunicipio (alimenta classificação e cálculo)
```

### 1.1 O modelo de dados: `tipos.ts`

A ideia central é separar **o que é da prefeitura** do **que é do imóvel**:

- **`PerfilMunicipio`** (de `municipios/<id>.json`) guarda leis e artigos (`normas`), a tabela de valor/m² por tipologia e padrão (`valores_construcao`, Anexo II), os fatores de conservação (Bom 1,0 / Regular 0,8 / Mau 0,5), as faixas de alíquota, o número de parcelas, a regra de arredondamento e a taxa de lixo. O código não traz nada de Mogi Mirim fixo; para outra cidade basta outro JSON. A exceção é o extrator do carnê (ver adiante).
- **`Caso`** é o imóvel concreto: `requerente`, `imovel`, `lancamento` (o que o carnê cobrou), `laudo`, `classificacao`, `confirmacoes` e `alertas`.
- **`origens: Record<string, Origem>`** é o detalhe mais importante do desenho. Para cada campo, pelo caminho com ponto (`"imovel.area_construida_m2"`), o caso registra de onde o valor veio (`fonte` + `ref`, como página ou rótulo do carnê) e, se houve divergência, `valor_original`. Isso é o que permite à tela mostrar "extraído do carnê" ou "sugerido pela IA".
- **`Extracao`** é o resultado parcial de um único documento: tudo `Partial<>`, com origens e alertas próprios. O cruzamento junta várias delas.

### 1.2 Extração: `extrair/`

#### `pdf.ts`: utilitários de baixo nível

- **`abrirPdf`** usa o `unpdf` (pdf.js) e devolve duas visões do documento:
  - `texto[]`: uma string por página, montada com `hasEOL`. O NBSP vira espaço porque o MSYS o usa nos números de item.
  - `itens(pagina)`: cada trecho de texto **com coordenadas** (x, y, largura). É carregado sob demanda.
- **`valorAbaixo(itens, rotulo)`** é a peça mais engenhosa. No carnê o texto sai fora de ordem, então em vez de regex ele localiza o rótulo e procura o item **geometricamente logo abaixo**: `y` menor, até 16 pt de distância e alinhado horizontalmente com o centro do rótulo. Entre os candidatos fica o mais próximo (o de maior `y`).
- **`numero`** decide o formato do número pela presença de vírgula: `"50.490,00"` vira 50490 (formato BR) e `"126.06"` vira 126,06 (formato do MSYS).

#### `index.ts`: despacho

`extrairDocumento` abre o PDF e testa cada extrator registrado em `EXTRATORES` pela função `reconhece`. Se algum reconhecer, ele extrai. Se nenhum reconhecer e `usarIA` estiver ligado, cai em `extrairComIA`. Detalhe sutil: o PDF é aberto com `dados.slice()` porque o pdf.js toma posse do buffer, e o original precisa continuar íntegro para mandar à IA.

#### `laudo-msys.ts`: laudo de vistoria

- **Cabeçalho (p.1)**: tudo por regex. O `id_vistoria` vem de um truque: o link `openview.html?<base64>` é decodificado e dele sai `idtInspection=`.
- **Requerente**: primeiro tenta as assinaturas da última página (nome, CPF, papel). Se não achar, usa o nome da p.1, que vem sem CPF. Com vários proprietários, usa o primeiro e gera um alerta.
- **Ambientes**: é uma pequena máquina de estados.
  1. Concatena as linhas de todas as páginas, descarta rodapés (`RODAPE`) e troca as legendas de foto por um marcador `QUEBRA` (`\u0000`).
  2. Recorta da seção `1.` até `Considerações finais`.
  3. Classifica cada linha: `N. Nome` abre um ambiente, `N.M - ...` abre um item, linha comum continua o item em curso, e texto depois de um bloco de fotos sem item aberto vai para `observacoes_gerais`.
  4. Os closures `fechaItem` e `fechaSolto` fazem o flush.
- Gera alerta quando o número no título difere do id do link, porque um é código do imóvel e o outro é da vistoria.

#### `carne-mogi-mirim.ts`: carnê

- O mapa `QUADRO` liga rótulo a campo, e um loop aplica `valorAbaixo` + `numero` para cada um. Assim o extrator é declarativo.
- Inscrição, código e exercício saem por regex da linha `Ref:`. Nome, endereço e CPF saem do bloco `Principal`. O endereço é quebrado em logradouro, número e bairro, com alerta se a quebra falhar.
- Ao final lista os rótulos que não apareceram, o que serve de detector de mudança de layout.
- Este é o único ponto com a cidade fixa no código (`municipio = 'Mogi Mirim'`). Faz sentido, já que o extrator é específico do carnê dessa prefeitura.

#### `generico-ia.ts`: alternativa paga

- Manda o PDF inteiro à Claude API com saída estruturada (zod).
- **Decisão de projeto:** em vez de um objeto com dezenas de campos opcionais, o esquema pede uma lista de pares `{campo, valor}`, com `campo` restrito a um enum de caminhos. O comentário explica que o objeto grande estoura o limite de gramática da saída estruturada.
- Depois converte para `Extracao`: números passam por `numero()`, e `grupo(prefixo)` remonta os subobjetos. O filtro `!resto.includes('.')` impede que `imovel.endereco.x` caia dentro de `imovel`.
- Sempre acrescenta o alerta "lido por IA — conferir", além dos `campos_incertos`.

### 1.3 Cruzamento: `cruzamento.ts`

**`montarCaso(municipio, extracoes)`** é o coração da consolidação:

1. Ordena as extrações por `PRIORIDADE = ['carne', 'bci', 'laudo', 'usuario']`. Para dado cadastral vale o carnê, que é o que a prefeitura tem.
2. Percorre quatro grupos (requerente, endereço, imóvel, lançamento) e, campo a campo:
   - se o campo está vazio, preenche e copia a origem;
   - se o valor é igual depois de `normaliza` (sem acento, maiúsculas, espaços colapsados), mantém. A exceção: se o atual está todo em MAIÚSCULAS (estilo carnê) e o novo tem caixa mista, troca pela grafia com acentos;
   - se o valor diverge, mantém o primeiro, anota `valor_original` na origem e gera um alerta.
3. Pós-processamento:
   - formata o CEP;
   - define `qualidade = 'proprietário'` por padrão;
   - herda as origens `laudo.*`;
   - junta os alertas de todas as extrações;
   - chama **`alertasLaudo`**;
   - preenche a tipologia inicial com `tipo_cadastro ?? laudo.categoria`;
   - compara a área útil do laudo com a área construída do cadastro. Acima de 5% de diferença, sugere pedir o croqui; abaixo, avisa para não afirmar erro de metragem.

**`alertasLaudo`** pega os itens com título "em bom estado" cuja parte depois de `Obs:` contém palavras de defeito (regex `DEFEITO`). É a tese central do pedido: o sistema de vistoria marca "bom estado" por padrão, mas as observações contam outra história.

### 1.4 Cálculo: `calc.ts`

A fórmula, com referência à LC 392/2025:

> **VVC** = área × valor/m² × FC  ·  **VVI** = VVT + VVC  ·  **IPTU** = VVI × alíquota da faixa

- **`r2`**: arredonda a centavos com `+ Number.EPSILON` para evitar o erro clássico em que 1.005 vira 1.00.
- **`faixaDe`**: primeira faixa em que `vvi <= ate`, sendo que `ate: null` significa sem limite. Lança erro se o VVI passar da última faixa cadastrada.
- **`tributos(perfil, vvt, vvc, area, lixoLancado)`** tem dois modos de arredondamento:
  - `por_parcela` (Mogi Mirim): calcula territorial mensal = r2(VVT × alíq / 11) e predial mensal = r2(VVC × alíq / 11), e o anual é a soma × 11. **É isso que faz o recálculo bater ao centavo com o carnê.** O lixo segue a mesma lógica.
  - `anual`: VVI × alíquota direto.
  - Se o perfil não tem taxa de lixo por m², usa o valor lançado.
- **`simular(caso, perfil, cenario)`**:
  - valida que o padrão tem valor e que a conservação existe;
  - usa por padrão a área e o VVT do cadastro, mas o cenário pode substituí-los (por exemplo, `--area 120`);
  - calcula `revisado`, e também `atual` recalculado a partir do lançamento;
  - **as reduções são medidas contra o valor cobrado no carnê**, não contra o recálculo. O recálculo só é usado se faltar o valor lançado;
  - devolve `memoria[]` com as frases prontas para o requerimento ("VVC revisado: 120,00 m² × R$ 757,04/m² = …").
- **`cenarios`**: produto cartesiano de tipologia × padrão × conservação, ordenado pelo IPTU.
- **`valorImplicito`**: faz a engenharia reversa do lançamento. Divide VVC por área para obter o valor efetivo por m² e, dividindo pela tabela, o FC que a prefeitura aplicou na prática. É útil para mostrar, por exemplo, que o lançamento já embute um FC diferente de 1,0.

### 1.5 Classificação por IA: `classificar.ts`

- **`esquema(perfil)`**: o esquema zod é **gerado a partir do perfil**. `tipologia`, `padrao` e `conservacao` viram `z.enum` com as chaves do JSON do município, então o modelo não consegue inventar um padrão que não existe na tabela.
- **`contexto`**: monta o prompt com normas e artigos, padrões disponíveis com valor e descrição, FCs, dados do cadastro e o laudo inteiro, ambiente por ambiente.
- **`SISTEMA`**: as regras de julgamento. Citar ambientes, desconfiar do "em bom estado" padrão, considerar a predominância e não o pior item, e ser honesto mesmo quando o resultado não favorece o pedido.
- **`classificar`** chama `messages.parse` com effort `high` e fallback no servidor, e trata `refusal`, `max_tokens` e resposta sem JSON válido. Depois:
  - **o impacto financeiro não vem do modelo.** `impactoConservacao` roda `simular` para cada estado e escreve "redução de R$ X" ou "AUMENTO de R$ X";
  - `chave()` tolera opções como `"Regular (0,8)"` ao casá-las com as chaves do perfil;
  - mapeia o `id` de cada confirmação para o campo do `Caso` que ela altera;
  - se o modelo não incluiu a confirmação de conservação, ela é criada mesmo assim, porque é a pergunta que mexe no dinheiro;
  - gera um **alerta de risco** se algum estado aumentaria o IPTU, já que pedir vistoria pode sair pela culatra.

### 1.6 Cola: `municipios.ts` e `routes/iptu.ts`

- **`municipios.ts`** relê os JSON a cada chamada, então editar um perfil não exige reiniciar. `perfilPorCidade` usa o mesmo `normaliza` do cruzamento.
- **Rotas** (resumo, já que a camada é fina):
  - `POST /documentos`: recebe o PDF cru (`express.raw`, nome no cabeçalho `X-Nome-Arquivo`) e chama `extrairDocumento`. A IA só é usada com `?ia=1` **e** chave configurada.
  - `POST /caso`: detecta o município pela primeira extração que tem cidade e chama `montarCaso`. Sem perfil cadastrado, o caso ainda é montado, só que com alerta de que não dá para simular.
  - `POST /simular`: o cenário vem do corpo ou da classificação atual. Devolve a simulação, todos os cenários e o valor implícito.
  - `POST /classificacoes` + `GET /:id`: um job assíncrono num `Map` em memória, porque a chamada leva 1–2 min. A tela consulta o status periodicamente. Os jobs com mais de 1 h são limpos sob demanda, a cada novo POST.
- **`auth.ts`**: HTTP Basic com `timingSafeEqual` e limite de 10 falhas por IP a cada 15 min. Sem credenciais no `.env`, não pede login.

### 1.7 Pontos para ficar de olho

Não são bugs confirmados; são coisas notadas na leitura do código:

1. **Tipologia inicial em `montarCaso`** (`cruzamento.ts`): usa `caso.imovel.tipo_cadastro ?? laudo.categoria`. Se o carnê trouxer em "Prédio / Tipo" algo diferente de `"Casa"` (por exemplo `"1 - CASA"`), esse valor não casa com as chaves de `valores_construcao`. Aí `/simular` falha com "sem valor/m²" até a classificação corrigir a tipologia. O formato real não foi verificado porque o caso está fora do git.
2. **Alerta de divergência sem origem**: se o primeiro valor não tinha origem registrada, o alerta mostra `(undefined)` e a origem cai em `fonte: 'usuario'`. É cosmético, mas engana.
3. **`faixaDe` lança erro para VVI acima de R$ 300 mil**. Com isso, um único padrão caro faz `cenarios()` inteiro falhar com 422, em vez de só pular aquele cenário. Hoje não acontece porque só há Casa Popular no perfil, mas vai acontecer quando o Anexo II for completado (já está nas `pendencias`).
4. **A alíquota predial vale também para a parcela territorial**. Está documentado e fecha com o carnê; só vale confirmar no texto da lei quando o perfil for revisado.
5. **Jobs de classificação só em memória**: reiniciar o processo na VPS perde o que estiver rodando. Já está documentado no comentário da rota.

---

## 2. A extração de PDF é por IA?

> **Pergunta:** atualmente a extração de PDF é por IA?

Não. Por padrão a extração é feita por código, sem IA. A IA só entra quando nenhum extrator reconhece o documento.

**Como funciona hoje** (`app/backend/src/extrair/index.ts`):

1. O PDF é aberto com o `unpdf`, que lê o texto que já existe no arquivo. Não há OCR nem modelo envolvido.
2. Cada extrator registrado tenta reconhecer o documento pelo conteúdo:
   - **Laudo MSYS**: a p.1 contém "Laudo de Vistoria de" e "msysvistorias.com.br". A leitura é por regex e pela máquina de estados dos ambientes.
   - **Carnê de Mogi Mirim**: o texto contém "MUNICÍPIO DE MOGI MIRIM" e "IPTU / TSP". A leitura é por regex e pela posição dos rótulos (`valorAbaixo`).
3. Se algum extrator reconhecer o documento, ele é usado e a extração termina aí, mesmo com a opção de IA ligada.
4. Só quando **nenhum** extrator reconhece entra o `extrairComIA`, e apenas se duas condições valerem:
   - a chave `ANTHROPIC_API_KEY` está configurada no backend;
   - a tela mandou `?ia=1`.

**Na tela** (`Documentos.tsx:19-20`): a caixa "ler por IA os formatos desconhecidos" já vem **marcada** sempre que o backend tem a chave. Na VPS, então, um PDF de formato desconhecido (laudo de outro sistema, carnê de outra cidade, BCI) vai direto para a IA, que custa cerca de US$ 0,10 a 0,50 por documento. A tela mostra uma etiqueta "IA" ou "extrator" em cada arquivo, então dá para ver qual caminho cada um seguiu.

**Resumo para o caso de Mogi Mirim:** o laudo e o carnê são lidos pelos extratores, de graça e na hora. A única etapa que sempre usa IA é a **classificação** (padrão e conservação, em `classificar.ts`), e ela só roda quando é disparada na tela.

Para que a IA na extração seja opt-in, basta a caixa começar desmarcada (`useState(false)`).

---

## 3. O que é o laudo MSYS?

> **Pergunta:** o que é laudo MSYS?

É o laudo de vistoria de locação gerado pelo **MSYS** (msysvistorias.com.br), um software usado por imobiliárias e vistoriadores para registrar o estado de um imóvel na entrada ou na saída de um inquilino. O vistoriador percorre o imóvel com o app no celular, lança cada item por ambiente com fotos, e o sistema gera um PDF padronizado. No repositório há até um print dessa tela de lançamento, citado em `docs/analise_exemplo_mogi_mirim.md`.

**No caso de Mogi Mirim** é o `laudo.pdf`: uma vistoria de entrada de locação, com 38 páginas e 388 fotos.

**Formato do PDF**, que é o que o extrator explora:

- **p.1, cabeçalho**: endereço, partes (proprietário e locatário), data, área útil, total de fotos e um link com o id da vistoria.
- **Seções por ambiente** (`1. Sala`, `2. Cozinha`…): cada item vem no formato `N.M - <título> em <estado>. Obs: <texto>`, intercalado com as legendas das fotos.
- **Última página**: assinaturas com nome, CPF e papel de cada um.

Como o layout é sempre o mesmo, dá para ler o laudo com regex, sem IA. Por isso ele tem um extrator próprio (`extrair/laudo-msys.ts`). Um laudo de outro sistema de vistoria cai na leitura por IA.

**Por que ele importa para o pedido de revisão:** é a evidência do estado de conservação do imóvel. O ponto fraco é que o MSYS marca quase tudo como "em bom estado" no título do item, enquanto as observações descrevem os defeitos. Daí o alerta `alertasLaudo`, que aponta essa contradição. Além disso, por ser um laudo de locação, ele não tem ART nem croqui, então a área útil que ele traz não substitui a área construída do cadastro.
