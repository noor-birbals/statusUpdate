import type { ServerEntry } from './types';

// Thin server-side client for the Linode Cloud API. Only ever called from
// API routes (never from the browser) — tokens must stay server-side
// environment variables and are never sent to the client.
//
// Supports up to two Linode accounts (two personal access tokens). Set
// LINODE_API_TOKEN for the first account and LINODE_API_TOKEN_2 for a
// second one — either can be used alone, or both together. Optional
// LINODE_API_TOKEN_LABEL / LINODE_API_TOKEN_2_LABEL name them in messages
// (defaults to "Account 1" / "Account 2").

export interface LinodeAccountConfig {
  label: string;
  token: string;
}

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
  // Internal: which account's token this instance came from, so follow-up
  // calls (like fetching CPU stats) hit the right account. Instance IDs are
  // only unique WITHIN an account, never assume they're globally unique.
  _accountToken: string;
}

export interface LinodeAccountError {
  label: string;
  error: string;
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

export function getConfiguredLinodeAccounts(): LinodeAccountConfig[] {
  const accounts: LinodeAccountConfig[] = [];
  const t1 = process.env.LINODE_API_TOKEN;
  if (t1) accounts.push({ label: process.env.LINODE_API_TOKEN_LABEL || 'Account 1', token: t1 });
  const t2 = process.env.LINODE_API_TOKEN_2;
  if (t2) accounts.push({ label: process.env.LINODE_API_TOKEN_2_LABEL || 'Account 2', token: t2 });
  return accounts;
}

async function fetchInstancesForToken(token: string): Promise<Omit<LinodeInstance, '_accountToken'>[]> {
  const instances: Omit<LinodeInstance, '_accountToken'>[] = [];
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

// Fetches instances from every configured account. A failure on one
// account (bad token, network issue, etc.) doesn't stop the others — it's
// reported back in accountErrors so the sync can still succeed partially.
export async function fetchAllLinodeInstances(): Promise<{
  instances: LinodeInstance[];
  accountErrors: LinodeAccountError[];
}> {
  const accounts = getConfiguredLinodeAccounts();
  if (accounts.length === 0) {
    throw new Error(
      'No Linode API token is configured on the server (set LINODE_API_TOKEN and/or LINODE_API_TOKEN_2)',
    );
  }

  const instances: LinodeInstance[] = [];
  const accountErrors: LinodeAccountError[] = [];

  await Promise.all(
    accounts.map(async (acct) => {
      try {
        const list = await fetchInstancesForToken(acct.token);
        list.forEach((inst) => instances.push({ ...inst, _accountToken: acct.token }));
      } catch (e) {
        accountErrors.push({
          label: acct.label,
          error: e instanceof Error ? e.message : 'Failed to reach Linode',
        });
      }
    }),
  );

  return { instances, accountErrors };
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
export async function fetchLinodeCpuPct(linodeId: number, token: string): Promise<number | null> {
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
