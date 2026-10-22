# Aprendizados de 2026-10-22 — área da vistoria × área do cadastro

## Regra

Para o cálculo vale a **área construída do cadastro da Prefeitura**, que é a base do lançamento. A vistoria pode
medir cada ambiente, e a soma pode não bater com o cadastro. Quando isso acontece, cada área medida é multiplicada
pela razão **área do cadastro ÷ área da vistoria**, e assim os blocos somam exatamente a área cadastral.

- A conta do ajuste (soma medida, fator, área de cada bloco antes e depois) aparece **só na memória de cálculo da
  tela** (passo 4).
- O requerimento (preparatório e final) **apenas menciona a divergência** entre as duas áreas, no item 3.3. Diz que
  o pedido adota a área cadastral sem reconhecer sua correção e reforça o pedido de critério de medição e croqui. As
  áreas dos blocos que ele mostra já são as ajustadas, as mesmas da memória da simulação.

## O que mudou no app

| Mudança | Onde |
|---|---|
| Campo novo `classificacao.area_principal_m2`: área do corpo principal medida na vistoria (opcional). Sem ele, o corpo principal continua sendo o restante da área do cadastro e não há ajuste | `tipos.ts`, `classificar.ts` (preservado ao reclassificar pela IA) |
| `simular` compara corpo principal + blocos medidos com a área do cadastro. Se diferir (≥ 0,01 m²), aplica o fator a cada bloco; o corpo principal fica com o restante, que absorve o arredondamento. Novos campos `ajuste_area` e `memoria_ajuste` | `calc.ts` |
| Passo 3: linha "Corpo principal" na tabela de blocos, com a área medida; aviso com o fator quando há divergência | `Classificacao.tsx` |
| Passo 4: as linhas do ajuste aparecem antes da memória | `Simulacao.tsx` |
| "Recalcular valores" agora confirma com uma mensagem verde (com a hora) e um link para o item 4. Simulação; a mensagem some quando a classificação muda | `Classificacao.tsx`, `Simulacao.tsx` (`id="simulacao"`) |
| Requerimento: tabela 3.3 e pedido de enquadramento usam as áreas ajustadas, com um parágrafo só sobre a divergência | `requerimento.ts` |

Exemplo (caso Porto, cadastro de 124,12 m²): a vistoria mede 100 + 20 (garagem) + 8 (serviço) = 128 m², o que dá
um fator de 0,9697 e as áreas 96,97 + 19,39 + 7,76 m².

## Área por ambiente lida do laudo

- O extrator MSYS lê a área quando ela vem no título do ambiente: `2. Garagem (20 m2)` (aceita `m²` e decimais) e
  grava em `Ambiente.area_m2`; o nome fica sem a área. O extrator genérico por IA ganhou o mesmo campo.
- Na classificação pela IA, cada bloco sem área digitada recebe a soma das áreas dos ambientes que ele cita
  (`ambientes: "2. Garagem"`, ou pelo nome). Se **todos** os demais ambientes tiverem área, a soma deles vira a área
  medida do corpo principal e dispara o ajuste proporcional. Área digitada pelo proprietário prevalece.
- A IA recebe a área medida junto com o título do ambiente.

Arquivo de teste `laudo_com_area.pdf` (fora do git): cópia do `laudo.pdf` com "(20 m2)" na Garagem e "(30 m2)" na
Área de Serviço, editado direto no texto do PDF. A fonte embutida não tem vírgula, por isso a área vai sem decimais.
Teste completo com o carnê e a IA: Garagem 20 m² (Telheiro Popular, Regular), Área de serviço 30 m² (Telheiro
Precário, Mau), corpo principal 74,12 m², IPTU R$ 394,68. Digitando 80 m² no corpo principal: vistoria de 130 m²,
fator 0,9548 e áreas de 76,38 + 19,10 + 28,64 m².

## Corpo principal pelo total do laudo

Sem área digitada para o corpo principal, o cálculo usa **área total do laudo − áreas medidas dos blocos** (o MSYS
traz o total no campo "Área útil" da p. 1, já lido em `laudo.area_util_m2`). Vale também para blocos digitados à mão.
A tela mostra o valor derivado como sugestão no campo do corpo principal; digitar um valor prevalece.

Caso-exemplo (`laudo_com_area.pdf`): 126,06 − 50,00 = 76,06 m² de corpo principal; vistoria de 126,06 m² × cadastro
de 124,12 m², fator 0,9846, áreas ajustadas de 74,89 + 19,69 + 29,54 m², VVC R$ 62.757,10. O requerimento só diz
que as áreas medidas somam 126,06 m² contra 124,12 m² do cadastro.

## Pendência

- A área útil do laudo agora é tratada como o total medido na vistoria (decisão do Rubens). Conceitualmente,
  área útil ≠ área construída: a "Ressalva sobre a metragem" continua no requerimento. O MSYS tem também o campo
  "Área total" (0.0 no exemplo), ainda não lido; se vier preenchido, talvez deva ter prioridade.
