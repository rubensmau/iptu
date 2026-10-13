// Login do app: HTTP Basic com um único usuário, definido no .env
// (IPTU_USUARIO / IPTU_SENHA). Sem nginx na frente: o próprio Express pede a
// senha, e o navegador a reenvia sozinho em todas as chamadas da tela à API.
// Atenção: na porta 8090 é HTTP puro — a senha trafega sem criptografia.
import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const USUARIO = process.env.IPTU_USUARIO;
const SENHA = process.env.IPTU_SENHA;

// tentativas erradas por IP; zera ao reiniciar o processo
const falhas = new Map<string, { n: number; desde: number }>();
const LIMITE = 10, JANELA = 15 * 60_000;

const igual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export function exigeSenha(req: Request, res: Response, next: NextFunction) {
  if (!USUARIO || !SENHA) return next(); // sem credenciais no .env: uso local, sem login
  const ip = req.ip ?? '?';
  const f = falhas.get(ip);
  if (f && Date.now() - f.desde > JANELA) falhas.delete(ip);
  if ((falhas.get(ip)?.n ?? 0) >= LIMITE) {
    return res.status(429).send('Muitas tentativas. Espere 15 minutos.');
  }
  const [tipo, cru] = (req.header('authorization') ?? '').split(' ');
  if (tipo === 'Basic' && cru) {
    const [u, ...resto] = Buffer.from(cru, 'base64').toString('utf-8').split(':');
    if (igual(u, USUARIO) && igual(resto.join(':'), SENHA)) return next();
    const atual = falhas.get(ip) ?? { n: 0, desde: Date.now() };
    falhas.set(ip, { ...atual, n: atual.n + 1 });
  }
  res.set('WWW-Authenticate', 'Basic realm="Revisão de IPTU", charset="UTF-8"');
  res.status(401).send('Autenticação necessária.');
}
