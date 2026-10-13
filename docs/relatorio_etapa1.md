# Relatório — app de revisão de IPTU, etapa 1 (2026-10-13)

Exemplo usado: imóvel da Rua Hermínio Cecatto, 64, Martim Francisco, **Mogi Mirim/SP**,
exercício 2026. Fontes: `laudo.pdf` (vistoria de locação MSYS, 38 páginas), `iptu.pdf`
(carnê 2026) e `revisao_iptu.docx` (requerimento preenchido à mão). O mapa campo a campo
está em [analise_exemplo_mogi_mirim.md](analise_exemplo_mogi_mirim.md).

## 1. O que foi construído

| Peça | O que faz | Validação no exemplo |
|---|---|---|
| Extrator do laudo MSYS | endereço, CEP, proprietário e CPF, data, área útil, fotos, nº do laudo e da vistoria, 12 ambientes / 16 itens com texto literal | 100% igual à referência |
| Extrator do carnê de Mogi Mirim | inscrição, código, áreas, testada, zona, valores venais, IPTU, lixo, parcelas — pela **posição** na página | 100% igual à referência |
| Leitura por IA (alternativa) | qualquer PDF sem extrator próprio (outro sistema de vistoria, outra prefeitura, BCI) | sobre os mesmos PDFs: 29 de 31 campos iguais, texto dos ambientes 100% igual, 34 s |
| Cruzamento | junta os documentos; o carnê vence nos dados cadastrais; divergências viram alerta | 5 alertas pertinentes (abaixo) |
| Cálculo | VVC = AC × VM²C × FC, faixa de alíquota, IPTU e lixo arredondados por parcela | reproduz o carnê **centavo por centavo** (638,33; 173,80; 812,13) |
| Classificação por IA | sugere padrão e conservação, monta os quadros 3.1/3.2, aponta pontos fracos e gera **perguntas de confirmação** com o impacto no IPTU | mesma conclusão do preenchimento manual (Casa Popular, Regular) |
| Interface web | upload → dados com origem → classificação e confirmações → simulação → baixar o caso | testada no navegador, sem erros |

Stack igual à da VPS: Express 5 + TypeScript (`tsx`) e React 19 + Vite; extração de PDF com
`unpdf` (~0,6 s e ~117 MB de pico no laudo de 7,5 MB). Nada em Python no servidor.

## 2. O que descobrimos

1. **A prefeitura é Mogi Mirim**, não Mogi Guaçu. Mogi Guaçu é só a cidade da vistoriadora.
2. **O lançamento atual não bate com nenhum fator de conservação da lei.** R$ 109.104,60 ÷
   124,12 m² = R$ 879,03/m², ou seja, fator 0,9289 sobre Casa Popular (R$ 946,30). A tabela só
   tem 1,00, 0,80 e 0,50. Ou a prefeitura usou outro padrão ou outro critério que não conhecemos.
3. **Risco real de o pedido sair caro.** Se a vistoria da prefeitura concluir "Bom", o valor
   venal passa de R$ 150 mil, a alíquota sobe para 0,40% e o IPTU **aumenta R$ 33,44/ano**:

   | Cenário (Casa Popular) | Valor venal | Alíquota | IPTU | Efeito |
   |---|---|---|---|---|
   | Mau | R$ 109.217,38 | 0,35% | R$ 382,36 | reduz R$ 255,97 |
   | **Regular** (pedido) | R$ 144.453,80 | 0,35% | **R$ 505,67** | **reduz R$ 132,66** |
   | Bom | R$ 167.944,76 | 0,40% | R$ 671,77 | aumenta R$ 33,44 |

4. **O laudo trabalha contra o pedido em dois pontos:** todos os 16 itens têm o título
   "em bom estado" (padrão do sistema de locação) e a pintura interna é nova. A IA apontou os
   dois como pontos fracos e sugeriu explicar isso no requerimento.
5. **O carnê arredonda por parcela.** O IPTU é (territorial mensal + predial mensal) × 11, com
   cada parcela arredondada. Por isso 159.594,60 × 0,40% dá 638,38 na conta direta, mas o carnê
   cobra 638,33.
6. **A taxa de lixo depende da área construída** (R$ 1,40/m²). Se a área cadastral mudar, ela muda.
7. **Nº do laudo:** o título do PDF diz **812** (código do imóvel na imobiliária). O **1013**
   citado no requerimento é o id da vistoria, escondido no link do QR code.
8. **Área:** o laudo diz 126,06 m² de área útil e o cadastro 124,12 m² de área construída
   (+1,6%). São conceitos diferentes, então não há base para alegar erro de metragem.
9. **Garagem e área de serviço** são telheiros (madeira, sem vedação nem forro); a área de
   serviço está em mau estado. Se estiverem dentro dos 124,12 m² com o valor de Casa Popular,
   pedir o enquadramento separado (Telheiro) pode reduzir mais. Depende do Anexo IV e da ficha cadastral.
10. A IA notou algo que o preenchimento manual não registrou: **metade dos cômodos não tem forro**
    (teto de telha de fibrocimento pintada), o limite inferior do padrão Popular.

## 3. Comparativo: preenchimento manual × app

| Item | Manual (`revisao_iptu.docx`) | App | Comentário |
|---|---|---|---|
| Dados do imóvel e do lançamento | preenchidos | iguais (84/84 campos) | extraídos sozinhos do laudo e do carnê |
| CPF do requerente | **em branco** | 083.***.***-08 | está no laudo e no carnê |
| CEP, zona/PGV, testada, valor/m² do lixo | ausentes | extraídos | úteis para o terreno e a taxa de lixo |
| Nº do laudo | só "1013" | 812 e 1013, com alerta | evita dúvida no protocolo |
| Tipologia / padrão / conservação | Casa, Popular, Regular | Casa, Popular, Regular (confiança média) | mesma conclusão |
| Quadro 3.1 (características) | 7 elementos, sem citar ambientes | 6 elementos, citando os ambientes pelo número | IA mais rastreável |
| Quadro 3.2 (estado) | 6 elementos | 6 elementos | equivalentes; a IA separa interno × externo |
| Pontos fracos do pedido | não tratados | 8 listados | p.ex. título "em bom estado", pintura nova |
| Risco de aumento ("Bom") | não mencionado | calculado e destacado | decisivo para o proprietário |
| IPTU revisado | R$ 505,59 | R$ 505,67 | o app usa o arredondamento do carnê (diferença de R$ 0,08) |
| Explicação dos R$ 638,33 | ausente | parcela arredondada × 11 | — |
| Fundamentação legal e 14 pedidos | redigidos | **ainda não gerados** | próxima etapa (.docx) |
| Anexo "Laudo de Avaliação Cadastral" | citado, mas não existe | — | remover ou produzir |
| Tempo | horas de trabalho manual | ~1 s de extração + ~1,5 min de IA | — |
| Custo de IA | — | ~US$ 0,21 por classificação (6,3 mil tokens de entrada, 9,3 mil de saída) | leitura por IA de documento desconhecido: custo à parte, ainda não medido |

## 4. Documentos adicionais que precisamos

**Para o perfil do município (vale para todos os imóveis da cidade):**

1. **LC 392/2025 de Mogi Mirim, completa, com os Anexos I a IV.** É o mais importante. Hoje
   os valores vêm do requerimento-exemplo, não da lei. Falta:
   - todos os padrões, inclusive Telheiro;
   - a descrição de cada padrão (para a IA classificar);
   - as alíquotas acima de R$ 300 mil e as do terreno.
2. **Código Tributário Municipal (Lei 1.431/1983), arts. 293–308.** Prazo e rito da impugnação.
3. **Formulário oficial e regras de protocolo** da prefeitura (presencial ou online, prazos, documentos exigidos).

**Do proprietário (para cada imóvel):**

4. **BCI / ficha cadastral / memória de cálculo do lançamento.** Mostra o padrão, a conservação e
   a área por bloco que a prefeitura usou. Explicaria o fator 0,93 e diria se garagem e área de
   serviço estão nos 124,12 m². **Vale pedir antes de protocolar**, para avaliar o risco do item 2.3.
5. **Carnê de 2025.** Mostra o salto causado pela nova PGV e reforça o contraditório do art. 11.
6. **Matrícula ou escritura** (vínculo com o imóvel) e **RG/CPF**; **procuração**, se outra pessoa protocolar.
7. **Planta aprovada, habite-se ou projeto**, se houver, para conferir a área construída.
8. **Fotos selecionadas** do laudo (388 no link do QR code) para o relatório fotográfico.
9. Opcional, para fortalecer: **laudo técnico com ART/RRT** de engenheiro ou arquiteto.

## 5. Como testar com outro imóvel

```bash
cd ~/pessoal/iptu/app/backend && npm run dev     # API em :3010 (lê ANTHROPIC_API_KEY do ambiente)
cd ~/pessoal/iptu/app/frontend && npx vite        # tela em http://localhost:5173
```

Envie o laudo e o carnê em PDF. O que não tiver extrator próprio é lido por IA, se a caixa
estiver marcada. Se o município não for Mogi Mirim, a tela mostra os dados extraídos, mas não
simula nem classifica até existir `municipios/<cidade>.json`.

## 6. Limitações e próximos passos

- **Requerimento (.docx)** no modelo da prefeitura, com a fundamentação e os pedidos. É a próxima etapa.
- O perfil de Mogi Mirim tem só Casa Popular: até chegar a lei, os outros padrões não simulam.
- A API **não tem login** e trata CPF e endereço: antes de subir na VPS, pôr autenticação como no
  exbogrim e decidir a retenção dos dados (LGPD). Os casos ficam só no navegador (localStorage)
  e no arquivo baixado.
- As classificações em andamento ficam na memória do backend: reiniciá-lo perde as que estão rodando.
- A classificação por IA não é determinística: duas rodadas deram a mesma conclusão com perguntas
  um pouco diferentes. Cada critério subjetivo passa pela confirmação do proprietário.
