import type { ServerEntry } from './types';

// Thin server-side client for the Linode Cloud API. Only ever called from
// API routes (never from the browser) — LINODE_API_TOKEN must stay a
// server-side environment variable and is never sent to the client.

export interface LinodeInstance {
  id: number;
  label: string;
  status: string; // e.g. "running" | "offline" | "rebooting"
  type: string;
  region: string;
  ipv4: string[];
  backups: {
    enabled: boolean;
    last_successful: string | null;
  };
}

// Linode region slugs aren't human-friendly on their own — map the ones
// in our fleet (and a few common others) to the same "City, ST" style
// already used throughout the board.
const REGION_LABELS: Record<string, string> = {
  'us-west': 'US, Fremont, CA',
  'us-east': 'US, Newark, NJ',
  'us-central': 'US, Dallas, TX',
  'us-southeast': 'US, Atlanta, GA',
  'us-iad': 'US, Washington, DC',
  'us-ord': 'US, Chicago, IL',
  'us-lax': 'US, Los Angeles, CA',
  'us-sea': 'US, Seattle, WA',
  'us-mia': 'US, Miami, FL',
  'ca-central': 'Canada, Toronto',
};

export function regionLabel(region: string): string {
  return REGION_LABELS[region] || region;
}

export async function fetchLinodeInstances(): Promise<LinodeInstance[]> {
  const token = process.env.LINODE_API_TOKEN;
  if (!token) {
    throw new Error('LINODE_API_TOKEN is not configured on the server');
  }

  const instances: LinodeInstance[] = [];
  let page = 1;

  for (;;) {
    const res = await fetch(`https://api.linode.com/v4/linode/instances?page=${page}&page_size=100`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Linode API error (${res.status}): ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    instances.push(...(data.data || []));
    if (!data.pages || page >= data.pages) break;
    page += 1;
  }

  return instances;
}

export function matchServerToInstance(
  server: ServerEntry,
  instances: LinodeInstance[],
): LinodeInstance | undefined {
  if (!server.ip) return undefined;
  const ip = server.ip.trim();
  return instances.find((inst) => inst.ipv4?.some((a) => a === ip));
}

// Linode's hypervisor reports real CPU usage per instance out of the box —
// no agent needed. It does NOT report in-guest memory usage (the API only
// knows the plan's allocated RAM, not what's actually used inside the
// guest), so this stays CPU-only; memory keeps using the manually-entered
// field elsewhere. Returns null (rather than throwing) when stats aren't
// available yet for a Linode, so one missing instance never fails a sync.
export async function fetchLinodeCpuPct(linodeId: number): Promise<number | null> {
  const token = process.env.LINODE_API_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(`https://api.linode.com/v4/linode/instances/${linodeId}/stats`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    const series: [number, number][] | undefined = data?.data?.cpu;
    if (!series || !series.length) return null;
    // Average the last few points so a single noisy sample doesn't jump the bar.
    const recent = series.slice(-3);
    const avg = recent.reduce((sum, [, v]) => sum + v, 0) / recent.length;
    return Math.min(100, Math.max(0, Math.round(avg)));
  } catch {
    return null;
  }
}
