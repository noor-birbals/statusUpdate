import { NextRequest, NextResponse } from 'next/server';
import { getStoredSession } from '@/lib/session';
import { readServers, writeServers } from '@/lib/servers-store';
import type { ServerStatus } from '@/lib/types';

const VALID_STATUSES: ServerStatus[] = ['active', 'flagged', 'done'];

// 'name' and 'ip' are intentionally excluded: they're required (non-optional)
// fields on ServerEntry, and nothing in the UI edits them via PATCH today —
// keeping this list to optional string fields avoids a widening mismatch.
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

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    next.status = body.status;
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
