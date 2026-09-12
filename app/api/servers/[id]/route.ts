import { NextRequest, NextResponse } from 'next/server';
import { getStoredSession } from '@/lib/session';
import { readServers, writeServers } from '@/lib/servers-store';
import type { ServerProvider, ServerStatus } from '@/lib/types';

const VALID_STATUSES: ServerStatus[] = ['active', 'flagged', 'done'];
const VALID_PROVIDERS: ServerProvider[] = ['linode', 'ioflood'];

// 'name' is handled separately below (it's required/non-empty, unlike these
// optional fields, so lumping it into this generic loop would widen the
// indexed-assignment type). 'ip' stays excluded — nothing in the UI edits it
// via PATCH today.
const STRING_FIELDS = [
  'hostname', 'os', 'plan', 'region', 'lastBackup',
  'linodeLabel', 'disk', 'mem', 'desc', 'backup', 'flagNote', 'notes',
] as const;

const ARRAY_FIELDS = ['websites', 'databases', 'findings'] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStoredSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const servers = await readServers();
  const idx = servers.findIndex((s) => s.id === id);
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const current = servers[idx];
  const next = { ...current };

  if (body.name !== undefined) {
    const trimmed = typeof body.name === 'string' ? body.name.trim() : '';
    if (!trimmed) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    }
    next.name = trimmed;
  }

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    next.status = body.status;
  }

  if (body.provider !== undefined) {
    if (body.provider === '' || body.provider === null) {
      next.provider = undefined;
    } else if (VALID_PROVIDERS.includes(body.provider)) {
      next.provider = body.provider;
    } else {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }
  }

  for (const field of STRING_FIELDS) {
    if (body[field] !== undefined) {
      next[field] = typeof body[field] === 'string' ? body[field] : current[field];
    }
  }

  for (const field of ARRAY_FIELDS) {
    if (body[field] !== undefined) {
      next[field] = Array.isArray(body[field])
        ? body[field].filter((v: unknown) => typeof v === 'string')
        : current[field];
    }
  }

  next.updatedAt = new Date().toISOString();
  servers[idx] = next;
  await writeServers(servers);

  return NextResponse.json({ server: next });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getStoredSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  const servers = await readServers();
  const next = servers.filter((s) => s.id !== id);
  if (next.length === servers.length) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  await writeServers(next);

  return NextResponse.json({ ok: true });
}
