import { promises as fs } from 'fs';
import path from 'path';
import type { ServerEntry } from './types';

// The live data file is NOT committed to git (see .gitignore) — it is
// runtime state written by the app itself and must survive `git pull`
// deploys untouched. On first run (or if it's ever missing) we bootstrap
// it from the tracked seed file so a fresh checkout still has sensible
// starting data.
const DATA_FILE = path.join(process.cwd(), 'data', 'servers.json');
const SEED_FILE = path.join(process.cwd(), 'data', 'servers.seed.json');

async function ensureFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    let seed = '[]';
    try {
      seed = await fs.readFile(SEED_FILE, 'utf-8');
    } catch {
      // no seed file — start empty
    }
    await fs.writeFile(DATA_FILE, seed, 'utf-8');
  }
}

export async function readServers(): Promise<ServerEntry[]> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeServers(servers: ServerEntry[]): Promise<void> {
  await ensureFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(servers, null, 2), 'utf-8');
}

export function newServerId(name: string, existingIds: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'server';
  let id = base;
  let n = 2;
  while (existingIds.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  return id;
}
