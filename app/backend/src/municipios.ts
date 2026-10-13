import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normaliza } from './cruzamento.js';
import type { PerfilMunicipio } from './tipos.js';

const DIR = resolve(import.meta.dirname, '../../../municipios');

/** Perfis lidos a cada chamada: editar o JSON não exige reiniciar o backend. */
export function perfis(): PerfilMunicipio[] {
  return readdirSync(DIR).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(resolve(DIR, f), 'utf-8')) as PerfilMunicipio);
}

export const perfil = (id: string) => perfis().find((p) => p.id === id) ?? null;

/** Perfil pelo nome da cidade e UF do imóvel ("MOGI MIRIM", "SP"). */
export function perfilPorCidade(municipio: string | null | undefined, uf?: string | null) {
  if (!municipio) return null;
  return perfis().find((p) => normaliza(p.nome) === normaliza(municipio) && (!uf || p.uf === uf.toUpperCase())) ?? null;
}
