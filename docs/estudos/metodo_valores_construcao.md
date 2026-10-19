# Método: estudo de fundamentação dos valores de construção

Roteiro genérico para montar, em qualquer município, o estudo que justifica perante a
Prefeitura os **valores do m² de construção**, as **tipologias e padrões** e os **fatores de
estado de conservação** usados num pedido de revisão do valor venal / IPTU.

Escopo deliberadamente restrito à **parcela da construção** (VVC). Terreno (valor por face
de quadra, fatores de esquina, gleba etc.), alíquotas, isenções e IPTU progressivo ficam fora,
salvo quando alteram a construção.

Aplicação ao primeiro município: [mogi_mirim_valores_construcao.md](mogi_mirim_valores_construcao.md).

---

## 1. Perguntas que o estudo precisa responder

| # | Pergunta | Onde costuma estar |
|---|---|---|
| P1 | Qual é a **fórmula** do valor venal da construção? | Lei da Planta Genérica de Valores (PGV) ou Código Tributário Municipal (CTM) |
| P2 | Quais são os **valores do m²** por tipologia e padrão, e para qual exercício? | Anexo da lei da PGV; decretos de atualização |
| P3 | Quais **tipologias e padrões** existem e como se distingue um do outro? | Anexo descritivo da PGV; regulamento do CTM (às vezes com tabela de pontos) |
| P4 | Quais são os **fatores de conservação** (e de idade/obsolescência, se houver) e como se define cada estado? | Anexo de fatores; regulamento do CTM |
| P5 | O que conta como **área construída** (beirais, varandas, telheiros, áreas abertas)? | CTM, regulamento, código de obras; às vezes nada escrito |
| P6 | Houve **atualização ou revisão** posterior (IPCA, decretos, leis alteradoras, erratas)? | Portal de legislação; Diário/Jornal Oficial |
| P7 | Qual a **origem técnica** dos valores (estudo, CUB, pesquisa de mercado, NBR 14653)? | Processo legislativo da PGV (mensagem, volumes, pareceres) |
| P8 | Qual o **rito e o prazo** para contestar, e desde quando a correção vale? | CTM (impugnação/reclamação), lei da PGV |

## 2. Fontes a coletar, em ordem de força

1. **Texto oficial da lei da PGV com anexos**, na versão consolidada **e** na publicada (Diário
   Oficial assinado). Conferir que o anexo publicado é o aprovado (erratas acontecem).
2. **Leis posteriores que alteram a PGV.** Ler o texto; o título nem sempre diz o alcance.
3. **Decretos do Executivo**: atualização monetária anual (IPCA/IGP-M), revisões
   administrativas, regulamentos. A EC 132/2023 (CF, art. 156, § 1º, III) permite atualizar a
   base de cálculo por decreto, desde que a lei municipal fixe os critérios.
4. **Regulamento do CTM** (decreto antigo). Costuma conter a tabela de pontuação dos padrões
   e a definição dos estados de conservação, e nem sempre é revogado pela PGV nova.
5. **Processo legislativo** da PGV na Câmara: mensagem do prefeito, mensagens modificativas,
   emendas, pareceres, veto, atas das comissões. É onde aparece (ou não aparece) a origem
   técnica dos valores.
6. **Respostas oficiais** (despachos a requerimentos de vereadores, notas da Secretaria de
   Finanças).
7. **Notícias** só servem como pista para achar o documento oficial.

Em cada busca, registrar: número, data, data de publicação, órgão, link de origem, data do
download e onde o arquivo foi guardado.

## 3. Conferências obrigatórias

- **Valor a valor**: comparar a tabela do anexo oficial com a usada no cálculo (no app,
  `municipios/<id>.json`). Fazer por programa, não a olho.
- **Anexo do projeto × anexo da lei**: emendas podem trocar anexos inteiros.
- **Consistência interna**: toda combinação tipologia × padrão com valor deve ter descrição
  no anexo descritivo, e vice-versa; nomes iguais nos dois anexos.
- **Exercício**: o valor vale para qual ano? A lei pode suspender a correção no primeiro ano
  e um decreto pode corrigir os anos seguintes.
- **Fatores**: confirmar a lista fechada de estados e os coeficientes; verificar se a lei
  define os estados ou só dá os números.
- **Área construída**: ver se há regra escrita de medição. Sem regra, a medição por laudo
  técnico (com ART/RRT) é o melhor argumento.

## 4. Estrutura do estudo para apresentar à Prefeitura

1. Identificação do município, exercício e normas vigentes.
2. Fórmula legal do valor venal da construção, com o texto do artigo.
3. Tabela de valores do m² usada, com a referência exata (lei, anexo, página) e o fator de
   atualização do exercício.
4. Tipologias e padrões: critérios legais (texto literal) e, se existir, a regra objetiva de
   pontuação.
5. Fatores de conservação: coeficientes e base legal; critério adotado para enquadrar.
6. Histórico de alterações (leis, decretos, erratas), dizendo se cada uma afeta ou não a
   construção.
7. Lacunas da legislação que justificam o pedido de memória de cálculo.
8. Anexos: cópia dos documentos oficiais citados.

Notas internas (riscos, pontos fracos, estratégia) ficam **em arquivo separado** e não
entram na versão protocolada.

## 5. Variações esperadas entre municípios

| Aspecto | Formas comuns |
|---|---|
| Valor do m² | Tabela por tipo e padrão (Mogi Mirim); CUB/Sinduscon × fator; valor único por zona |
| Padrão | Descrição qualitativa; pontuação por elementos construtivos; ambos |
| Conservação | 3 estados (Bom/Regular/Mau); 4 ou 5 estados; combinado com idade (Ross-Heidecke) |
| Idade | Ausente; fator de obsolescência por faixa de idade; depreciação contínua |
| Atualização | Decreto anual por índice; só por lei; revisão periódica obrigatória (Lei Orgânica) |
| Área | Área total coberta; exclusão de beirais; áreas abertas com fator redutor |

O perfil do município no app (`municipios/<id>.json`) deve registrar, para cada item, o valor
**e** a referência normativa, para que o requerimento cite a fonte automaticamente.
