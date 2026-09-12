import { NextRequest, NextResponse } from 'next/server';
import { getStoredSession } from '@/lib/session';
import { newServerId, readServers, writeServers } from '@/lib/servers-store';
import type { ServerEntry, ServerStatus } from '@/lib/types';

const VALID_STATUSES: ServerStatus[] = ['active', 'flagged', 'done'];

export async function GET() {
  const session = await getStoredSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const servers = await readServers();
  return NextResponse.json({ servers });
}

export async function POST(request: NextRequest) {
  const session = await getStoredSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const status: ServerStatus = VALID_STATUSES.includes(body?.status) ? body.status : 'active';

  const servers = await readServers();
  const id = newServerId(name, new Set(servers.map((s) => s.id)));

  const entry: ServerEntry = {
    id,
    name,
    ip: typeof body?.ip === 'string' ? body.ip.trim() : '',
    hostname: typeof body?.hostname === 'string' ? body.hostname.trim() : undefined,
    os: typeof body?.os === 'string' ? body.os.trim() : undefined,
    status,
    plan: typeof body?.plan === 'string' ? body.plan.trim() : undefined,
    region: typeof body?.region === 'string' ? body.region.trim() : undefined,
    websites: Array.isArray(body?.websites) ? body.websites.filter((w: unknown) => typeof w === 'string') : [],
    databases: Array.isArray(body?.databases) ? body.databases.filter((d: unknown) => typeof d === 'string') : [],
    desc: typeof body?.desc === 'string' ? body.desc.trim() : undefined,
    backup: typeof body?.backup === 'string' ? body.backup.trim() : undefined,
    findings: [],
    notes: '',
    updatedAt: new Date().toISOString(),
  };

  servers.push(entry);
  await writeServers(servers);

  return NextResponse.json({ server: entry }, { status: 201 });
}
