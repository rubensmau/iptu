import { randomUUID } from 'node:crypto';
import express, { Router } from 'express';
import { simular, valorImplicito, type Cenario } from '../calc.js';
import { classificar, recalcularEfeitos, type ResultadoClassificacao } from '../classificar.js';
import { conferirRegistro, montarCaso } from '../cruzamento.js';
import { extrairDocumento } from '../extrair/index.js';
import { lacunas } from '../lacunas.js';
import { gerarRequerimento, nomeRequerimento } from '../requerimento.js';
import { perfil, perfilPorCidade, perfis } from '../municipios.js';
import type { Caso, Extracao, Registro } from '../tipos.js';

const router = Router();
const temChave = () => Boolean(process.env.ANTHROPIC_API_KEY);

router.get('/municipios', (_req, res) => {
  res.json({
    municipios: perfis().map((p) => ({
      id: p.id, nome: p.nome, uf: p.uf, exercicio: p.exercicio, pendencias: p.pendencias,
      padroes: Object.fromEntries(Object.entries(p.valores_construcao).map(([t, ps]) => [t, Object.keys(ps)])),
      conservacao: Object.keys(p.fatores_conservacao),
    })),
    ia_disponivel: temChave(),
  });
});

// Um PDF por chamada, corpo binário; o nome vai no cabeçalho (sem multer).
router.post('/documentos', express.raw({ type: 'application/pdf', limit: '30mb' }), async (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) {
    return res.status(400).json({ error: 'envie o PDF no corpo, com Content-Type: application/pdf' });
  }
  const nome = decodeURIComponent(String(req.get('X-Nome-Arquivo') ?? 'documento.pdf'));
  const usarIA = req.query.ia === '1' && temChave();
  try {
    res.json(await extrairDocumento(new Uint8Array(req.body), nome, usarIA, String(req.query.tipo ?? '') || undefined));
  } catch (e) {
    res.status(500).json({ error: `falha ao ler ${nome}: ${(e as Error).message}` });
  }
});

router.post('/caso', express.json({ limit: '5mb' }), (req, res) => {
  const extracoes: Extracao[] = req.body?.extracoes ?? [];
  if (!extracoes.length) return res.status(400).json({ error: 'nenhum documento extraído' });
  const end = extracoes.map((e) => e.endereco).find((e) => e.municipio);
  const p = req.body.municipio ? perfil(req.body.municipio) : perfilPorCidade(end?.municipio, end?.uf);
  const caso = montarCaso(p?.id ?? 'desconhecido', extracoes);
  if (!p) caso.alertas.unshift(`Município "${end?.municipio ?? '?'}" sem perfil cadastrado: dá para revisar os dados, mas não simular nem classificar.`);
  res.json({ caso });
});

router.post('/simular', express.json({ limit: '5mb' }), (req, res) => {
  const caso: Caso = req.body?.caso;
  const p = caso && perfil(caso.municipio);
  if (!p) return res.status(422).json({ error: 'município sem perfil cadastrado' });
  const c = caso.classificacao;
  const cenario: Cenario = {
    tipologia: req.body.cenario?.tipologia ?? c.tipologia ?? Object.keys(p.valores_construcao)[0],
    padrao: req.body.cenario?.padrao ?? c.padrao ?? '',
    conservacao: req.body.cenario?.conservacao ?? c.conservacao ?? '',
    ...(req.body.cenario?.area_m2 ? { area_m2: Number(req.body.cenario.area_m2) } : {}),
    acessorias: c.acessorias,
  };
  try {
    res.json({
      simulacao: cenario.padrao && cenario.conservacao ? simular(caso, p, cenario) : null,
      implicito: valorImplicito(caso, p),
    });
  } catch (e) {
    res.status(422).json({ error: (e as Error).message });
  }
});

// Refaz os valores do passo 3 (efeito da conservação, alerta de risco) após o
// proprietário mudar padrão, blocos ou áreas — conta pura, sem IA.
router.post('/classificacoes/recalculo', express.json({ limit: '5mb' }), (req, res) => {
  const caso: Caso = req.body?.caso;
  const p = caso && perfil(caso.municipio);
  if (!p) return res.status(422).json({ error: 'município sem perfil cadastrado' });
  try {
    res.json(recalcularEfeitos(caso, p));
  } catch (e) {
    res.status(422).json({ error: (e as Error).message });
  }
});

// Matrícula/escritura enviada depois de montado o caso: só os alertas da conferência.
router.post('/registro/conferencia', express.json({ limit: '5mb' }), (req, res) => {
  const caso: Caso = req.body?.caso;
  const registro: Registro = req.body?.registro;
  if (!caso || !registro) return res.status(400).json({ error: 'envie o caso e o registro' });
  res.json({ alertas: conferirRegistro(caso, registro) });
});

// O que falta para protocolar; a tela mostra no passo 5.
router.post('/lacunas', express.json({ limit: '5mb' }), (req, res) => {
  const caso: Caso = req.body?.caso;
  if (!caso) return res.status(400).json({ error: 'envie o caso' });
  res.json({ lacunas: lacunas(caso, perfil(caso.municipio)) });
});

// Requerimento em .docx: preparatório (lacunas destacadas) ou final (?final=1, limpo para protocolar).
router.post('/requerimento', express.json({ limit: '5mb' }), async (req, res) => {
  const caso: Caso = req.body?.caso;
  const p = caso && perfil(caso.municipio);
  if (!p) return res.status(422).json({ error: 'município sem perfil cadastrado: não há modelo de requerimento' });
  try {
    const final = req.query.final === '1';
    const { buffer } = await gerarRequerimento(caso, p, new Date(), final);
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.set('Content-Disposition', `attachment; filename="${nomeRequerimento(caso, final)}"`);
    res.send(buffer);
  } catch (e) {
    res.status(500).json({ error: `falha ao gerar o requerimento: ${(e as Error).message}` });
  }
});

// A classificação leva 1–2 min; roda em segundo plano e a tela consulta.
// Fica em memória: reiniciar o backend perde os trabalhos em curso.
const trabalhos = new Map<string, { status: 'rodando' | 'pronto' | 'erro'; resultado?: ResultadoClassificacao; erro?: string; inicio: number }>();

router.post('/classificacoes', express.json({ limit: '5mb' }), (req, res) => {
  if (!temChave()) return res.status(503).json({ error: 'ANTHROPIC_API_KEY não configurada no backend' });
  const caso: Caso = req.body?.caso;
  const p = caso && perfil(caso.municipio);
  if (!p) return res.status(422).json({ error: 'município sem perfil cadastrado' });
  if (!caso.laudo?.ambientes.length) return res.status(422).json({ error: 'o caso não tem laudo com ambientes' });
  const id = randomUUID();
  trabalhos.set(id, { status: 'rodando', inicio: Date.now() });
  classificar(caso, p)
    .then((resultado) => trabalhos.set(id, { status: 'pronto', resultado, inicio: trabalhos.get(id)!.inicio }))
    .catch((e) => trabalhos.set(id, { status: 'erro', erro: (e as Error).message, inicio: trabalhos.get(id)!.inicio }));
  for (const [k, t] of trabalhos) if (Date.now() - t.inicio > 3_600_000) trabalhos.delete(k);
  res.status(202).json({ id });
});

router.get('/classificacoes/:id', (req, res) => {
  const t = trabalhos.get(req.params.id);
  if (!t) return res.status(404).json({ error: 'classificação não encontrada (o backend reiniciou?)' });
  res.json({ ...t, segundos: Math.round((Date.now() - t.inicio) / 1000) });
});

export default router;
