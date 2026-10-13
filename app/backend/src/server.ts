import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { resolve } from 'node:path';
import { exigeSenha } from './auth.js';
import iptu from './routes/iptu.js';

const app = express();
app.use(exigeSenha);
app.use(cors());

app.use('/api', iptu);

// Na VPS não há nginx: o próprio backend serve a tela já buildada (STATIC_DIR).
if (process.env.STATIC_DIR) {
  const dir = resolve(process.env.STATIC_DIR);
  app.use(express.static(dir));
  app.get('/{*resto}', (_req, res) => res.sendFile(resolve(dir, 'index.html')));
}

const port = Number(process.env.PORT ?? 3010);
app.listen(port, () => console.log(`iptu backend on :${port}`));
