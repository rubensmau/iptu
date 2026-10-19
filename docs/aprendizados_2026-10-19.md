# Aprendizados de 2026-10-19 — legislação conferida, matrícula e valor de mercado

Fontes desta rodada:

- Pasta `municipios/mogi_mirim_legislacao/` (fora do git), montada pelo Rubens e pelo sócio, e os documentos
  baixados para o estudo em `coletados_2026-10-19/` (decretos, processo do PLC 14/2025 na Câmara, despacho da
  Secretaria de Finanças).
- `Escritura e Matricula Nova.pdf` (fora do git): matrícula nº 2.004 do CRI de Mogi Mirim e escritura de 27/07/2022.
- Série do IPCA do IBGE (SIDRA, tabela 1737), agora em `indices/ipca.json`.

Estudo completo da legislação em [estudos/mogi_mirim_valores_construcao.md](estudos/mogi_mirim_valores_construcao.md)
(versão para a Prefeitura), [estudos/mogi_mirim_notas_internas.md](estudos/mogi_mirim_notas_internas.md) (uso
interno) e [estudos/metodo_valores_construcao.md](estudos/metodo_valores_construcao.md) (roteiro genérico).
Resumo de pendências para leitura humana: `pendencias_mogi_mirim_2026-10-19.docx` (nesta pasta, fora do git); a
mesma lista está na seção 3 abaixo.

## 1. O que a legislação confirmou

1. **Valores do m² (Anexo II) e fatores de conservação (Tabela VI):** os 28 valores e os 3 fatores do perfil batem
   com os anexos oficiais. O Anexo II aprovado é idêntico ao do projeto original.
2. **2026 sem correção:** LC 392, art. 12, § 2º, e Decreto 9.709/2025 (corrigiu os demais tributos em 4,46% e
   excluiu a PGV). A partir de 2027, decreto anual pelo IPCA (art. 12, § 1º), ainda não publicado.
3. **Nenhuma norma posterior mexeu na construção.** Os decretos de 2026 (9.798, 9.844, 9.904, 9.999, 10.006, 10.039)
   revisaram só faces de quadra (terreno). LC 412/2026 trata do art. 14; LC 414/2026, do art. 8º. A LC 400/2025,
   que o perfil listava como pendente, é da Patrulha Agrícola.
4. **Decreto 1.859/1984** (regulamento do CTM, não revogado): mesmos tipos e padrões, mesmos fatores (desde 1984) e
   uma **tabela de pontos** para o padrão (Casa: Precário até 150, Popular 151–250, Médio 251–340).
5. **Lacunas da lei:** não define os estados de conservação nem a medição da área construída; o processo
   legislativo não traz memória de cálculo do Anexo II (a mensagem fala em "pesquisas de mercado").
6. **Arquivos enganosos na pasta:** `ctm.pdf` é a LC 192/2005 (ISS), não o CTM; "Codigo Tributario atualizado
   2026.pdf" é a LC 414/2026.

## 2. O que mudou no app

| Mudança | Onde |
|---|---|
| Botão **Recalcular valores** na etapa 3: refaz o efeito de cada estado de conservação e o alerta de risco sem chamar a IA. Fica logo abaixo da classificação por ambiente | `classificar.ts` (`recalcularEfeitos`), rota `POST /classificacoes/recalculo`, `Classificacao.tsx` |
| Tabela "Cenários (padrão × conservação)" removida da etapa 4 e da resposta de `/simular`: só variava o corpo principal e confundia. Fica o parágrafo do valor implícito do lançamento | `Simulacao.tsx`, `routes/iptu.ts` |
| Requerimento cita o **Decreto 9.709/2025** (valores de 2026 sem correção; decretos de 2026 só sobre terreno) e o **Decreto 1.859/1984** (pontuação do padrão); o pedido de memória inclui a pontuação | `municipios/mogi_mirim.json` (`normas`, `refs.atualizacao`, `refs.pontuacao`, `fundamentacao`), `requerimento.ts`, `tipos.ts` |
| **Matrícula/escritura**: vaga nova no passo 1 e quadro no passo 2 (também para caso já montado). Sempre lida por IA (costuma ser foto). Não altera os dados do caso: confere titulares, inscrição, endereço, área do terreno, área construída averbada e preço pago, e vira alertas que começam com "Matrícula". Entra nos anexos como comprovante de vínculo e a descrição da construção vai para a análise da IA | `extrair/registro-ia.ts`, `cruzamento.ts` (`conferirRegistro`), rota `POST /registro/conferencia`, `Documentos.tsx`, `Campos.tsx`, `classificar.ts` |
| **Valor de mercado**: com escritura, o preço pago é corrigido pelo IPCA até dezembro do ano anterior ao exercício. Se o valor venal lançado passar disso, o requerimento ganha dois parágrafos (CTN art. 33; STJ Tema 1.113 e CTN art. 148; LC 392 art. 25) e um pedido subsidiário de limitar o valor venal ao de mercado | `mercado.ts`, `requerimento.ts`, `lacunas.ts`, `indices/ipca.json`, `npm run ipca` |
| Tipos `Gravidade`/`Lacuna` movidos para `tipos.ts` (a tela importava `lacunas.ts`, que agora lê o disco) | `tipos.ts`, `lacunas.ts`, `api.ts` |

**Caso-exemplo com a matrícula:** confere titular, inscrição, endereço e área do terreno (360 m²). Coproprietária
Roseli Morena Porto. Sem área construída averbada: a matrícula descreve "casa de tijolos e telhas, com sete cômodos
internos, área na frente, forrada em parte e ladrilhada". Preço de R$ 115.000 (07/2022) corrigido para R$ 132.779,94
(12/2025, fator 1,1546), contra valor venal lançado de R$ 159.594,60: **20,2% acima**.

## 3. Pendências e problemas (Mogi Mirim)

Prioridade: **Alta** bloqueia o protocolo ou muda o resultado; **Média** afeta a força do pedido; **Baixa** é
melhoria; **Info** é registro.

### A. Legislação e regras do município

| # | Item | Situação | O que fazer | Quem | Prior. |
|---|---|---|---|---|---|
| 1 | Prazo e canal de impugnação | CTM (Lei 1.431/1983, arts. 293–308) não obtido | Obter o texto; confirmar prazo, forma e documentos | Rubens / sócio | Alta |
| 2 | Efeito no próprio ano (art. 27) | Só vale em 2026 se a impugnação for tempestiva ou houver erro inequívoco | Protocolar dentro do prazo do item 1 | Rubens / sócio | Alta |
| 3 | Correção de 2027 | App sem fator por exercício; decreto de IPCA costuma sair no último trimestre | Quando sair, pôr no perfil; rodar `npm run ipca` em janeiro | Claude (app) | Média |
| 4 | Pontuação de 1984 | Não se sabe se a Prefeitura ainda usa; forro grau 5 duvidoso (19,5 ou 17,5) | Conferir no original; perguntar na Prefeitura | Sócio | Média |
| 5 | Estados de conservação sem definição | Só coeficientes na lei | Argumento já no requerimento | — | Info |
| 6 | Área construída sem regra de medição | LC 392 não define o que entra em "AC" | Requerimento pede critério e croqui; correção de área só com levantamento com ART | Sócio | Média |
| 7 | Origem técnica do Anexo II | Sem memória de cálculo no processo da Câmara | Argumento para pedir memória; opcional: Lei de Acesso à Informação | Sócio | Info |
| 8 | Terreno não contestado | Anexo I e fatores fora do app; VVT lançado mantido | Esperar o caso de terreno | Sócio | Baixa |
| 9 | Taxa de lixo | Vem do carnê, não de lei | Levantar a lei da taxa | Rubens | Baixa |
| 10 | Alíquota das Zonas Industriais | 0,40% (art. 9º, VI) fora do app | Só se aparecer imóvel em ZPI | Claude (app) | Baixa |

### B. Riscos e estratégia do pedido

| # | Item | Situação | O que fazer | Quem | Prior. |
|---|---|---|---|---|---|
| 11 | Prefeitura concluir "Bom" | No exemplo, o IPTU sobe | Usar "Recalcular valores" após mexer nos blocos; pedido evita vistoria in loco | Proprietário | Alta |
| 12 | Garagem como Telheiro | Casa Popular admite "cobertura simples para um veículo" | Telheiro é tipologia pela forma (só cobertura e apoios); fotos e medidas | Sócio | Média |
| 13 | Telheiro Popular × Precário | Pé-direito e vãos decidem | Medir pé-direito, fotografar apoios | Vistoria | Média |
| 14 | Precário × Popular | Forro e laje em parte podem dar Popular pelos pontos | Simular os pontos antes de pedir Precário | Sócio | Média |
| 15 | Laudo sem ART/RRT | Aceitação em teste | Registrar a resposta no primeiro protocolo | Sócio | Média |
| 16 | Valor de mercado | Valor venal 20% acima do preço de 2022 corrigido; a Prefeitura pode alegar valorização real | Decidir se o argumento fica; juntar avaliação atual (corretor ou laudo NBR 14653) | Sócio | Média |
| 17 | Coproprietária | Roseli Morena Porto também é titular | Incluir no requerimento ou anexar autorização | Proprietário | Média |

### C. Dados e documentos que faltam

| # | Item | Situação | O que fazer | Quem | Prior. |
|---|---|---|---|---|---|
| 18 | Área de cada ambiente | Laudo de locação não tem | Proprietário mede; futuro app de vistoria | Proprietário | Alta |
| 19 | Questionário do sócio (Word) | Não chegou | Enviar | Sócio | Média |
| 20 | Retorno sobre o rascunho | Aguardando | Ler e comentar | Sócio | Média |
| 21 | Caso de terreno | Em andamento | Enviar documentos | Sócio | Baixa |
| 22 | Dados do requerente | Telefone, e-mail, assinatura, RG/CPF, procuração | Preencher no protocolo | Proprietário | Info |

### D. App

| # | Item | Situação | O que fazer | Quem | Prior. |
|---|---|---|---|---|---|
| 23 | Extração parcial de PDF | IA não é chamada quando o extrator lê só parte (decisão adiada em 14/10) | Medir vazios nos próximos PDFs e decidir | Rubens + Claude | Média |
| 24 | Anexo IV incompleto no perfil | 15 combinações só com a referência; Casa resumida | Guardar o texto literal | Claude (app) | Baixa |
| 25 | Conferência por pontos na etapa 3 | Sugestão | Decidir se vale | Rubens | Baixa |
| 26 | Requerentes múltiplos | O requerimento tem um requerente só | Decidir se lista todos os titulares da matrícula | Rubens | Baixa |
| 27 | Tipologia inicial do carnê | Outro formato ("1 - CASA") quebra a simulação até classificar | Verificar com o próximo carnê | Claude (app) | Baixa |
| 28 | Alerta de divergência sem origem | Pode mostrar "(undefined)" | Corrigir junto com outra mudança | Claude (app) | Baixa |
| 29 | Classificação só em memória | Reiniciar perde o trabalho em curso | Aceito por enquanto | — | Baixa |

O `.docx` de pendências foi gerado antes dos itens 16, 17 e 26 (matrícula e valor de mercado).
