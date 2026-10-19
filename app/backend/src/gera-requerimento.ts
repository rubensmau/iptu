// Gera o rascunho do requerimento (.docx) de um caso e lista as lacunas.
// Uso: npm run requerimento -- [casos/x.json] [--saida /tmp/x.docx] [--final]
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gerarRequerimento, nomeRequerimento } from './requerimento.js';
import type { Caso, PerfilMunicipio } from './tipos.js';

const raiz = resolve(import.meta.dirname, '../../..');
const lerJson = <T>(caminho: string): T => JSON.parse(readFileSync(resolve(raiz, caminho), 'utf-8'));
const args = process.argv.slice(2);
const i = args.indexOf('--saida');
const saida = i >= 0 ? args.splice(i, 2)[1] : undefined;
const final = args.includes('--final');
if (final) args.splice(args.indexOf('--final'), 1);

const caso = lerJson<Caso>(args[0] ?? 'casos/exemplo_porto.json');
const perfil = lerJson<PerfilMunicipio>(`municipios/${caso.municipio}.json`);
const { buffer, lacunas } = await gerarRequerimento(caso, perfil, new Date(), final);
const destino = resolve(saida ?? resolve(raiz, 'casos', nomeRequerimento(caso, final)));
writeFileSync(destino, buffer);
console.log(`${destino} (${Math.round(buffer.length / 1024)} KB)\n\nLacunas (${lacunas.length}):`);
for (const l of lacunas) console.log(`  [${l.gravidade}] ${l.texto}`);
