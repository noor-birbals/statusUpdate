import { NextResponse } from 'next/server';
import { getStoredSession } from '@/lib/session';
import { newServerId, readServers, writeServers } from '@/lib/servers-store';
import { fetchAllLinodeInstances, fetchLinodeCpuPct, matchServerToInstance, regionLabel } from '@/lib/linode';
import type { ServerEntry, ServerStatus } from '@/lib/types';

export async function POST() {
  const session = await getStoredSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let instances;
  let accountErrors;
  try {
    const result = await fetchAllLinodeInstances();
    instances = result.instances;
    accountErrors = result.accountErrors;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to reach Linode' },
      { status: 502 },
    );
  }

  const servers = await readServers();
  const now = new Date().toISOString();
  let matched = 0;

  // Update every server already on the board that matches a Linode instance by IP.
  const updated = await Promise.all(
    servers.map(async (s) => {
      const inst = matchServerToInstance(s, instances);
      if (!inst) return s;
      matched += 1;
      const cpuPct = await fetchLinodeCpuPct(inst.id, inst._accountToken);
      return {
        ...s,
        linodeLabel: inst.label,
        plan: inst.type,
        region: regionLabel(inst.region),
        linodeStatus: inst.status,
        provider: 'linode' as const,
        cpuPct: cpuPct !== null ? cpuPct : s.cpuPct,
        lastBackup: inst.backups?.last_successful
          ? new Date(inst.backups.last_successful).toLocaleString()
          : s.lastBackup,
        linodeSyncedAt: now,
        updatedAt: now,
      };
    }),
  );

  // Any instance in either Linode account that isn't tracked yet (no server
  // on the board has its IP) gets added as a new card — this is what makes
  // newly-discovered machines actually show up after a sync.
  const knownIps = new Set(servers.map((s) => s.ip?.trim()).filter(Boolean));
  const newInstances = instances.filter((inst) => !inst.ipv4?.some((ip) => knownIps.has(ip)));

  const existingIds = new Set(updated.map((s) => s.id));
  const added: ServerEntry[] = [];
  for (const inst of newInstances) {
    const cpuPct = await fetchLinodeCpuPct(inst.id, inst._accountToken);
    const id = newServerId(inst.label || 'server', existingIds);
    existingIds.add(id);
    added.push({
      id,
      name: inst.label,
      ip: inst.ipv4?.[0] || '',
      status: 'active' as ServerStatus,
      linodeLabel: inst.label,
      plan: inst.type,
      region: regionLabel(inst.region),
      linodeStatus: inst.status,
      provider: 'linode',
      cpuPct: cpuPct !== null ? cpuPct : undefined,
      lastBackup: inst.backups?.last_successful
        ? new Date(inst.backups.last_successful).toLocaleString()
        : undefined,
      websites: [],
      databases: [],
      findings: [],
      linodeSyncedAt: now,
      updatedAt: now,
    });
  }

  const next = [...updated, ...added];
  await writeServers(next);

  return NextResponse.json({
    servers: next,
    matched,
    added: added.length,
    total: instances.length,
    accountErrors,
  });
}
