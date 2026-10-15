# Expansão para outras cidades

Resumo do `Relatorio_Cidades_IPTU_ITBI_Atualizado.docx` (fora do git), recebido em 2026-10-15, com comentários.

## Quadro legal

O sócio falou de uma "exigência normativa nova". Pelo relatório, **não existe uma norma única** que obrigue a cobrar
pelo valor declarado. São duas mudanças que apontam na mesma direção:

1. **STJ, Tema 1.113 (ITBI).** A base do ITBI é o valor de mercado em condições normais. O valor declarado pelo
   contribuinte presume-se verdadeiro. O município não pode impor um "valor venal de referência" unilateral: se
   discordar, precisa abrir procedimento próprio (art. 148 do CTN).
2. **EC 132/2023 (IPTU).** O novo art. 156, § 1º, III, da Constituição permite atualizar a base do IPTU por decreto,
   **desde que conforme critérios estabelecidos em lei municipal**. A LC 392/2025 de Mogi Mirim cita a EC 132 no art. 11.

Para o produto, isso significa que cresce o valor de discutir a **classificação e os parâmetros** usados pela
prefeitura (padrão, conservação, áreas, fatores), e não só o valor final.

Cuidado ao usar no requerimento: o Tema 1.113 é sobre ITBI, que tem base própria (valor de mercado). Por isso o
requerimento de IPTU não o cita. Ele só pede que a revisão sirva "como referência em futuras transmissões". A EC 132 e
o art. 25 da LC 392 (NBR de avaliação) entraram na fundamentação.

## Cidades (avaliação do relatório)

| Cidade | Atratividade | Observação |
|---|---|---|
| Mogi Mirim | Muito alta (oportunidade imediata) | PGV nova (LC 392/2025), inconsistências reconhecidas, muitos pedidos potenciais. **Já tem perfil no app.** |
| Campinas | Muito alta | PGV atualizada em 2025, recadastramento georreferenciado, transparência |
| São Paulo | Muito alta | referência nacional em metodologia, mas mercado e contencioso muito maiores |
| São José dos Campos | Alta | |
| Sorocaba, Jundiaí, Indaiatuba | Alta | |
| Ribeirão Preto | Média/alta | |
| Americana, Limeira | Média | |
| Mogi Guaçu | Média | vizinha; "a verificar" em quase tudo |

O relatório é preliminar: a maior parte das células diz "provável" ou "parcial". A tabela foi gerada por um assistente
corporativo (há resíduos de "BizChat" no texto). **Conferir na fonte antes de investir numa cidade.**

## O que é preciso para abrir uma cidade no app

Um arquivo `municipios/<id>.json` com:

1. **Lei da PGV** e anexos: tabela de valor por m² por tipo e padrão (como o Anexo II de Mogi Mirim), descrição dos
   padrões (Anexo IV), fatores de conservação e, se houver, de idade e outros.
2. **Fórmula** do valor venal da construção. Se a cidade usar fatores que o app não conhece (idade, depreciação,
   posição), é preciso estender o `calc.ts`.
3. **Alíquotas** por faixa e a regra de arredondamento das parcelas, para o recálculo bater com o carnê.
4. **Fundamentação e citações do requerimento** (`requerimento.fundamentacao` e `requerimento.refs`), destinatário e
   título.
5. **Prazo e canal de protocolo**, e o efeito da revisão no tempo (o equivalente ao art. 27 de Mogi Mirim).
6. Um **carnê de exemplo**: sem extrator próprio, ele é lido por IA (custa centavos e precisa de conferência).

Primeiro passo sugerido: Campinas ou Mogi Guaçu. Baixar a lei da PGV e um carnê real e montar o perfil.
