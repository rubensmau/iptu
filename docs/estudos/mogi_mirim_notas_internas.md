# Mogi Mirim — notas internas do estudo de valores de construção

**Uso interno. Não protocolar.** Complementa [mogi_mirim_valores_construcao.md](mogi_mirim_valores_construcao.md)
com riscos, inventário dos arquivos recebidos e ajustes a fazer no app. Estudo de 19/10/2026.

## 1. Inventário de `municipios/mogi_mirim_legislacao/`

| Arquivo | O que é | Uso |
|---|---|---|
| `Lei Planta Genérica de Valores (PGV) …pdf` | LC 392/2025 consolidada (legislacaodigital, 20/09/2026), sem anexos | Usado |
| `G3LxP-….pdf` | LC 392/2025 original assinada e publicada (18 p., imagem) | Usado |
| `Anexo II Valor Construção.pdf` = `ic6FA_….pdf` | Anexo II (mesmo texto) | Usado |
| `vVkK….pdf` | Anexo III, Tabelas I a VI | Usado (só a Tab. VI) |
| `4QwG-….pdf` | Anexo IV | Usado |
| `gx7V….pdf` | Errata da Tabela III do Anexo III | Citado (terreno) |
| `Lei complementar nº 414_2026 …pdf` = `Codigo Tributario atualizado 2026.pdf` | LC 414/2026 (mesmo conteúdo; o segundo nome engana, **não é o CTM**) | Citado |
| `6NTp….pdf` | Ofício CM/GP 502/2025 (Câmara acolhe o veto) | Citado |
| `Bairros com excessão.pdf` ≈ `Revisao Estradas.pdf` | Decreto 9.904/2026 (duas digitalizações do mesmo decreto) | Citado (terreno) |
| `ctm.pdf` | **LC 192/2005 — ISSQN**, não o CTM do IPTU | Fora do escopo |
| `Anexo I …`, `Planta Generica de Valores 2025*.pdf`, `0197S7…pdf`, pasta `Planta Generica de Valores/` | Anexo I (422 p.) e folhas do atlas da PGV | Fora do escopo (terreno) |
| `Plano Diretor …pdf` | LC 363/2022 | Fora do escopo |
| `Modelo_Laudo_Técnico_…_29518_Revisado.docx` | Modelo de laudo do sócio (imóvel de 490,88 m², Casa Médio Bom) | Coerente com o estudo |
| `Link com a Planta Genérica de Valores.docx` | Arquivo vazio (0 byte) | — |

**Falta obter:** o texto da **Lei 1.431/1983 (CTM)**, ao menos os arts. 10, 36 e 293 a 308
(prazo e rito da impugnação), e conferir no original digitalizado do Decreto 1.859/1984 o
forro, coluna 5, da Tabela II.

## 2. Riscos e pontos fracos para o pedido

- **Casa Popular admite "cobertura simples para um veículo"** entre as dependências típicas.
  A Prefeitura pode alegar que a cobertura da garagem já faz parte do padrão Popular e não
  merece bloco Telheiro. Resposta: o Anexo IV define tipologia pela forma construtiva
  ("apenas de cobertura e seus apoios", "sem fechamentos laterais"), e a lei multiplica
  **área** por valor da tipologia. A descrição da composição típica da casa não converte a área
  aberta em área de casa.
- **Telheiro Popular × Precário:** o Popular pede "vãos médios com pé-direito elevado"; o
  Precário, "vãos reduzidos, pé-direito reduzido" e admite apoio em muros. Medir o pé-direito
  e fotografar os apoios.
- **Pontuação de 1984:** se a Prefeitura ainda usa a Tabela II, uma casa com laje ou forro em
  parte dos cômodos pode pontuar Popular mesmo com acabamentos ruins. Antes de pedir Precário,
  simular a pontuação com o laudo. O forro sozinho vale só de 4 a 19,5 pontos.
- **Conservação sem definição legal** corta para os dois lados: facilita argumentar Regular,
  mas a vistoria municipal pode concluir Bom. O app já mostra esse risco na etapa 3.
- **Art. 27:** só a **impugnação tempestiva** ou o erro inequívoco da Prefeitura garantem efeito
  no próprio exercício. Fora do prazo, a redução vale a partir do ano seguinte. O prazo de
  impugnação continua sem levantamento (CTM).
- **Secretário de Finanças na Comissão (ata de 2025):** disse que "a classificação padrão já é
  aplicada nacionalmente". Indica que os padrões seguem modelo genérico (o de 1984 é parecido
  com tabelas de outras cidades paulistas), e não estudo local.

## 3. Ajustes no app (`municipios/mogi_mirim.json`)

1. **Valores e fatores:** nada a corrigir (28/28 e 3/3 conferem).
2. **Pendências desatualizadas:** a LC 400/2025 não tem relação com a PGV (trata da Patrulha
   Agrícola); a LC 412/2026 altera só o art. 14 e a LC 414/2026 só o art. 8º. Nenhuma toca a
   construção.
3. **Anexo IV incompleto no perfil:** 15 combinações têm só a referência ("Anexo IV, 3.4"),
   sem texto (Escritório, Loja, Indústria, Especial, Alta Tecnologia), e as de Casa estão
   resumidas. Para citar no requerimento, guardar o texto literal.
4. **Exercício:** o perfil não registra o fator de correção por exercício. Em 2026 é 1,00
   (Decreto 9.709). Quando sair o decreto de 2027, a tabela precisa de um fator (IPCA) ou de
   valores novos.
5. **Pontuação de 1984:** pode virar uma conferência opcional na etapa 3 (quantos pontos o
   laudo dá), útil para escolher entre Popular e Precário.
