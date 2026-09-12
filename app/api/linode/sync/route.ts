import { NextResponse } from 'next/server';
import { getStoredSession } from '@/lib/session';
import { readServers, writeServers } from '@/lib/servers-store';
import { fetchAllLinodeInstances, fetchLinodeCpuPct, matchServerToInstance, regionLabel } from '@/lib/linode';

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

  const next = await Promise.all(
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
        cpuPct: cpuPct !== null ? cpuPct : s.cpuPct,
        lastBackup: inst.backups?.last_successful
          ? new Date(inst.backups.last_successful).toLocaleString()
          : s.lastBackup,
        linodeSyncedAt: now,
        updatedAt: now,
      };
    }),
  );

  await writeServers(next);

  const knownIps = new Set(servers.map((s) => s.ip?.trim()).filter(Boolean));
  const unmatched = instances
    .filter((inst) => !inst.ipv4?.some((ip) => knownIps.has(ip)))
    .map((inst) => ({ label: inst.label, ip: inst.ipv4?.[0] || '', status: inst.status }));

  return NextResponse.json({
    servers: next,
    matched,
    total: instances.length,
    unmatched,
    accountErrors,
  });
}
