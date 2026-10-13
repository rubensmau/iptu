# Análise do exemplo — revisão de IPTU, Mogi Mirim (2026)

## Contexto

Objetivo final: app que ajude um proprietário a pedir revisão do IPTU/valor venal,
preenchendo o requerimento da prefeitura a partir de documentos que ele já tem
(laudo de vistoria, carnê do IPTU etc.) e pedindo só o que falta. Cada prefeitura
tem lei e formato próprios. Exemplo analisado: `revisao_iptu.docx`
(preenchido) + `laudo.pdf` + `iptu.pdf` (fontes). Esta etapa: mapear a origem de cada dado do
requerimento para separar o que é extraível, o que vem de outro documento, o que vem
da legislação municipal e o que é julgamento/cálculo.

## Observações iniciais (corrigir premissas)

- **A prefeitura é Mogi Mirim, não Mogi Guaçu.** O imóvel fica em Mogi Mirim
  (endereço do laudo e cabeçalho do requerimento). "Mogi Guaçu" aparece só na data
  do laudo — é a cidade da vistoriadora/imobiliária.
- O laudo é uma **vistoria de entrada de locação** (sistema MSYS, 38 págs., 388
  fotos), não um laudo técnico de engenharia (sem ART, sem croqui, sem padrão
  construtivo). `app_outro.jpeg` é a tela do app MSYS onde o vistoriador lança cada item.
- **Nº do laudo:** o requerimento cita "Laudo nº 1013", mas o título do PDF diz
  "Laudo de Vistoria de Entrada 812". 812 é o código do imóvel na imobiliária; 1013
  vem do link (`aWR0SW5zcGVjdGlvbj0xMDEz` = base64 de `idtInspection=1013`). Quem
  preencheu decodificou o link — pode gerar dúvida no protocolo; convém citar os dois.
- **Risco:** todos os itens do laudo vêm com o texto padrão "Registro geral **em bom
  estado**", e os defeitos só aparecem nas observações. O fiscal pode usar isso
  contra o pedido de "Regular". O app deve alertar e citar as observações.

## Mapa de origem dos dados

### A. Extraídos do laudo (confere)
| Campo do requerimento | Laudo |
|---|---|
| Endereço: Rua Hermínio Ce**catt**o, 64, Martim Francisco, Mogi Mirim/SP | p.1 — grafia "Ce**cat**o"; CEP 13817-075 (não usado) |
| Contribuinte: Mauricio Costa Porto | p.1 e p.38 (proprietário) |
| Data da vistoria: 22/01/2026 | p.1 |
| Área útil 126,06 m² (ressalva de metragem) | p.1 ("Área útil 126.06 / Área total 0.0") |
| Ambientes: sala, 3 quartos, corredor, banheiro, sala de jantar, cozinha | seções 3–10 |
| Materiais: alvenaria, cerâmica, forro PVC, fibrocimento (Brasílit), telha cerâmica na garagem, esquadrias de ferro/madeira, pisos de cimento externos | seções 1–12 |
| Defeitos: bolor, umidade, trincas, ferrugem, vidros trincados/faltando, trinco quebrado, vazamento nas conexões, registro espanado, torneira sem manopla, chuveiro com resistência queimada, porta sanfonada quebrada, Brasílit em mau estado na área de serviço, pilares de madeira podres | seções 2, 3, 7, 9, 10, 11, 12 |
| Garagem e área de serviço com cobertura simples/deteriorada | seções 2.2 e 11 |
| Total de fotos (relatório fotográfico anexo) | p.1: 388 fotos |

### B. Está no laudo mas ficou em branco no requerimento
- **CPF do proprietário: 083.***.***-08** (p.38) — o campo "CPF: ____" poderia vir preenchido.

### C. Não está no laudo — veio do carnê `iptu.pdf` (documento de arrecadação 2026) — **confirmado, tudo confere**
- Inscrição municipal 81-38-25-0102-001; código reduzido 40065 (`Código:40065-2026-1`); exercício 2026
- Área do terreno 360,00 m²; área construída 124,12 m²
- Valor venal do terreno R$ 50.490,00; da edificação R$ 109.104,60; total R$ 159.594,60
- IPTU R$ 638,33; coleta de lixo R$ 173,80; total R$ 812,13
- Grafia "HERMINIO CECATTO" e nome sem acento "MAURICIO" — vieram do carnê
- CPF 083.***.***-08 também está no carnê
- Campos do carnê **não usados** no requerimento e úteis para o app: Zona/PGV **49**,
  testada **12,00 m**, Prédio/Tipo **Casa**, área ideal 360,00, valor m² lixo R$ 1,40,
  11 parcelas, imposto territorial mensal R$ 18,36 e predial mensal R$ 39,67
- Explicação dos R$ 0,05: o carnê arredonda por parcela —
  (18,36 + 39,67) × 11 = 638,33, enquanto 159.594,60 × 0,40% = 638,38. Idem lixo:
  15,80 × 11 = 173,80 (≈ 124,12 × 1,40 = 173,77). O app deve simular pelo mesmo
  critério (parcela mensal arredondada × nº de parcelas) para bater com o carnê.
- O carnê **não informa padrão nem conservação** — por isso o requerimento pede a
  memória de cálculo (os R$ 879,03/m² não batem com nenhum FC da Tabela VI).
- A taxa de lixo depende da área construída (R$/m²): se a área cadastral mudar, muda.

### D. Não está no laudo — vem da legislação de Mogi Mirim
- LC 392/2025 (PGV): arts. 3º §2º, 4º, 5º II (VVC = AC × VM²C × FC), 9º (alíquotas
  0,35% até R$ 150 mil; 0,40% de R$ 150.000,01 a 300 mil), 11 p.ú., 32, 33
- Anexo II: Casa Popular = R$ 946,30/m²; Anexo III Tab. VI: FC Bom 1,00 / Regular 0,80 / Mau 0,50
- Anexo IV: descrição do padrão Popular
- Lei 1.431/1983 (CTM), arts. 293–308 (contraditório)
- Estrutura do requerimento (Secretaria de Finanças, Central de Atendimento IPTU/ITBI/TSP)

### E. Julgamento (feito a partir de A + D)
- Enquadramento "Casa – padrão Popular" e "conservação Regular (FC 0,80)"
- Sugestão de classificar garagem/área de serviço como "Telheiro"
- Tabelas 3.1/3.2 (resumo do laudo + conclusão por elemento)

### F. Cálculos (derivados de C + D) — conferidos
- 109.104,60 / 124,12 = R$ 879,03/m² ✔
- 946,30 × 0,80 = 757,04 ✔; 124,12 × 757,04 = 93.963,80 ✔
- 50.490,00 + 93.963,80 = 144.453,80 ✔; × 0,35% = 505,59 ✔
- Reduções 15.140,80 e 132,74 ✔; totais 812,13 / 679,39 ✔
- 638,33 vs 638,38: explicado pelo arredondamento das parcelas (ver C).
- Simulação revisada pelo critério do carnê: 50.490 × 0,35% / 11 = 16,07 e
  93.963,80 × 0,35% / 11 = 29,90 → (16,07 + 29,90) × 11 = **505,67** (o requerimento
  diz 505,59; diferença de R$ 0,08, irrelevante, mas o app deve ser consistente).

### G. Faltando (só o proprietário fornece)
- Telefone, e-mail, data e assinatura
- Anexos: RG/CPF, carnê, comprovante de vínculo (matrícula/escritura), BCI, procuração
- "Laudo de Avaliação Cadastral preenchido a partir do Laudo nº 1013" — citado nos
  anexos, mas não existe nos arquivos (ou é outro documento a gerar)
- Tabela de controle de anexos e comprovante de protocolo (vazios, esperado)

## Conclusão para o desenho do app

Um requerimento combina 5 fontes, cada uma tratada de forma diferente:
1. **Laudo de vistoria** → extração (texto do PDF; layout MSYS é regular: seções
   numeradas "N. Ambiente" / "N.M - ... Obs: ...").
2. **Carnê/BCI** → extração de outro documento (`iptu.pdf`: texto extraível, rótulos
   fixos "Área do Terreno", "Valor Venal Edificação - R$" etc., com valor na linha seguinte).
3. **Perfil da prefeitura** → dados fixos por município (lei, tabelas de valores,
   FC, alíquotas, modelo do requerimento). É a parte a generalizar.
4. **Classificação** (padrão e conservação) → LLM sobre as observações do laudo
   + descrições do Anexo IV, com revisão do proprietário.
5. **Dados pessoais/anexos** → formulário para o usuário.

