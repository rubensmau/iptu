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

## Pendência

- A área útil do laudo (`laudo.area_util_m2`) **não** entra no ajuste: é outro conceito e continua só na
  "Ressalva sobre a metragem". O ajuste usa apenas as áreas medidas e digitadas por ambiente no passo 3.
