# Aprendizados de 2026-10-15 — respostas do sócio, lei oficial e relatório de cidades

Fontes desta rodada:

- [respostas_socio_v1.md](respostas_socio_v1.md): as 7 dúvidas do relatório da etapa 1 e as respostas do Mauricio.
- `Relatorio_Cidades_IPTU_ITBI_Atualizado.docx` (fora do git): cidades para expansão e o quadro legal. Resumo em
  [expansao_cidades.md](expansao_cidades.md).
- **Texto oficial da LC 392/2025 de Mogi Mirim**, com os Anexos I a IV, a errata e o acolhimento do veto, baixado do
  portal da Prefeitura ([legislação, LC 392/2025](https://www.mogimirim.sp.gov.br/legislacao/view/30875/lei-complementar-n-3922025)).
  Até ontem o perfil usava números copiados do requerimento-exemplo. Agora usa a lei.

## 1. O que cada resposta mudou no app

| # | Dúvida | Resposta do sócio | O que mudou |
|---|---|---|---|
| 1 | Pedir vistoria pode aumentar o IPTU? Pedir antes o BCI? | O proprietário só tem o carnê. A prefeitura não está fornecendo o BCI de 2026. | O carnê continua sendo a fonte principal. O BCI deixou de ser pré-requisito: o próprio requerimento pede o BCI e a memória de cálculo (pedido 2) e registra que eles não foram fornecidos. O pedido de vistoria virou "análise do relatório fotográfico e, **só se a prefeitura achar indispensável**, vistoria". Isso reduz o risco de a vistoria concluir "Bom". |
| 2 | Prazo e canal para contestar 2026 | Muita gente não está pagando e ainda dá para pedir o recálculo. No pior caso, vale para 2027 e para futuras vendas (ITBI). | A lei confirma: o **art. 27** diz que a redução por mudança cadastral só vale no exercício seguinte, **salvo impugnação tempestiva ou erro inequívoco da Administração**. O pedido 1 agora é "impugnação tempestiva do lançamento de 2026 e, subsidiariamente, revisão cadastral com efeito a partir de 2027, inclusive para certidão de valor venal e futuras transmissões". |
| 3 | Laudo de locação vale como prova sem ART? | O sócio vai testar sem ART. O laudo de locação é um bom laudo fotográfico e pode dispensar a vistoria. **O pedido, assinado pelo proprietário, independe do laudo.** | O laudo passa a ser anexado "como relatório fotográfico" e o alerta do app diz isso. A falta de ART virou um ponto a conferir (não um bloqueio). O pedido 13 mantém o prazo para juntar ART, se exigida. **Em aberto:** o sócio quer trocar o app de vistoria por um que monte o laudo já na linguagem da lei. Ver §3. |
| 4 | Telheiro para garagem e área de serviço | Tem enquadramento próprio e reduz. A proposta é **classificar por ambiente, com m² por ambiente e valor proporcional**. | Feito. O passo 3 tem a tabela "Classificação por ambiente": cada bloco (garagem, área de serviço…) recebe tipologia, padrão, conservação e área. O VVC é a soma dos blocos, e o corpo principal fica com a área restante. A IA sugere os blocos, mas **não inventa metragem**: a área é lacuna até o proprietário medir. Telheiro: Popular R$ 269,85/m², Precário R$ 122,66/m² (contra R$ 946,30 da Casa Popular). |
| 5 | Que argumentos funcionam além da conservação | Os da lei (padrão, área, idade, terreno), resumidos num questionário em Word. | O perfil agora tem o **Anexo IV inteiro** (descrição de cada padrão). A IA compara o imóvel com cada padrão, não só com o sugerido. **Lacuna:** o questionário em Word do sócio não chegou aqui. Ver §3. |
| 6 | Os 14 pedidos servem para qualquer imóvel? | O exemplo é simples e discute só a construção. Há padrões mais sofisticados a testar e um caso mais complexo, com terreno, em andamento. | Os pedidos agora são montados a partir do caso (blocos, faixa de alíquota, laudo) e as citações vêm do perfil do município (`requerimento.refs`), não do código. A contestação do terreno (Anexo I, fatores FL/FG/FT/FA) **ainda não está no app**: o VVT lançado é mantido. |
| 7 | Outras cidades | Há exigência nova de critérios claros em lei para cobrar pelo valor venal. | O relatório esclarece que não há uma norma única. São duas mudanças: o **STJ Tema 1.113** (ITBI) e a **EC 132/2023** (IPTU). O app ganhou o art. 25 e a EC 132 na fundamentação. Cidades em [expansao_cidades.md](expansao_cidades.md). |

## 2. O que a lei oficial revelou

1. **A tabela completa (Anexo II)** tem 30 combinações de tipo e padrão. Para Casa: Luxo R$ 2.889,81; Fino R$ 1.934,31;
   Médio R$ 1.330,83; Popular R$ 946,30 (confere com o exemplo); **Precário R$ 501,67**.
2. **O padrão Popular exige forro** ("telhas … sobre estrutura de madeira, com forro"). O **Precário** descreve
   "telhas de fibrocimento … sem forro". Na etapa 1 a IA viu que metade dos cômodos do exemplo não tem forro. É um
   argumento novo e forte, que a IA agora recebe. Cuidado: o Precário também fala em autoconstrução e cômodos sem
   função definida, o que não descreve o exemplo. É mais um argumento de "Popular no limite inferior" do que um pedido de
   Precário.
3. **O mistério do fator 0,93 tem uma explicação plausível.** Nenhum FC da tabela dá R$ 879,03/m². Mas
   111,78 m² de Casa Popular Bom + 12,34 m² de Telheiro Popular dão R$ 109.107,37, contra R$ 109.104,60 lançados (a diferença vem do arredondamento das áreas). Ou seja,
   a prefeitura **provavelmente já separou um telheiro de ~12 m² e considerou a casa em estado Bom**. Se isso se
   confirmar, o ganho do pedido está na conservação e na área do telheiro, não no Telheiro em si. O app mostra essas
   hipóteses no passo 4. O requerimento cita a principal como exemplo e pede a memória por bloco. **É hipótese, não fato.**
4. **Alíquotas completas (art. 9º):** 0,35% até R$ 150 mil; 0,40% até R$ 300 mil; 0,45% até R$ 450 mil; 0,50% até R$ 600 mil;
   0,55% acima. Valem para o imposto predial e o territorial, como o app já fazia.
5. **Fórmula do terreno (art. 5º, I):** VVT = ATT × VM²T × FL × FG × FT × FA. O VM²T vem do Anexo I, por face de quadra
   (422 páginas). Isso será a base para o "caso mais complexo" de terreno que o sócio citou.
6. **Art. 25:** a avaliação segue a NBR da ABNT de avaliação de imóveis urbanos. **Art. 12, § 2º:** a PGV de 2026 não teve
   atualização monetária.

### Efeito no exemplo de Mogi Mirim (IPTU lançado R$ 638,33)

| Cenário | IPTU | Efeito |
|---|---|---|
| Casa Popular Regular (pedido da etapa 1) | R$ 505,67 | reduz R$ 132,66 |
| idem + garagem de 18 m² como Telheiro Precário Regular (área ilustrativa) | R$ 464,09 | reduz R$ 174,24 |
| Casa Popular Bom (risco se a prefeitura vistoriar) | R$ 671,77 | aumenta R$ 33,44 |
| Casa Precário Regular (só para referência) | R$ 351,12 | reduz R$ 287,21 |

## 3. Lacunas que continuam abertas

O app gera o requerimento mesmo assim: cada lacuna sai em amarelo no .docx e numa lista na primeira página, e a tela
mostra a mesma lista no passo 5.

1. **Prazo e canal de protocolo** em Mogi Mirim (CTM, arts. 293 a 308): não levantados.
2. **Alterações da LC 392/2025** (LC 400/2025, LC 412/2026 e LC 414/2026) não foram lidas. Pelos títulos, mexem nos arts. 8º e 14,
   longe da construção, mas vale conferir.
3. **Questionário em Word** do sócio para montar o laudo: precisamos dele para alinhar a análise da IA (e o futuro app
   de vistoria) às perguntas que ele usa.
4. **Área de cada ambiente:** o laudo de locação não tem. Sem ela, o bloco fica fora do cálculo e o pedido só pede o
   enquadramento. Opções: o proprietário mede, ou o futuro app de vistoria registra a metragem.
5. **Terreno:** o Anexo I e os fatores do terreno não estão no app. O VVT lançado é mantido.
6. **Aceitação sem ART:** em teste nos primeiros casos.
7. **Taxa de lixo:** o valor por m² vem do carnê, não de lei.
8. **Decisão adiada da extração parcial** (memória de 2026-10-14): retomar quando chegarem novos PDFs.

## 4. Próximos passos sugeridos

- Testar o rascunho do requerimento com o caso real e ajustar a redação com o sócio.
- Levantar o prazo e o canal de protocolo e completar a pendência do perfil.
- Receber o questionário em Word e o caso de terreno.
- Novo município: copiar `municipios/mogi_mirim.json` e trocar tabela, fatores, alíquotas, `requerimento.refs` e
  `requerimento.fundamentacao`. O carnê de outra cidade cai na leitura por IA até ganhar um extrator próprio.
