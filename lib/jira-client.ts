import type { JiraIssue, JiraSearchResponse } from './types';

async function fetchPage(host: string, jql: string, nextPageToken?: string): Promise<JiraSearchResponse> {
  const res = await fetch('/api/jira/search', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, jql, nextPageToken, maxResults: 100 }),
  });

  if (res.status === 401) throw new Error('401 Unauthorized — please sign in again.');

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${body ? ': ' + body.slice(0, 200) : ''}`);
  }

  return res.json();
}

async function fetchAllWithJql(host: string, jql: string): Promise<JiraIssue[]> {
  const all: JiraIssue[] = [];
  let nextPageToken: string | undefined;

  while (true) {
    const data = await fetchPage(host, jql, nextPageToken);
    all.push(...(data.issues || []));
    if (data.isLast || !data.nextPageToken || (data.issues || []).length === 0) break;
    nextPageToken = data.nextPageToken;
  }

  return all;
}

export async function fetchAllIssues(host: string, jql: string, fallbackJql?: string): Promise<JiraIssue[]> {
  try {
    const issues = await fetchAllWithJql(host, jql);
    // If sprint JQL returned nothing, fall back to broader query
    if (issues.length === 0 && fallbackJql) {
      return fetchAllWithJql(host, fallbackJql);
    }
    return issues;
  } catch (e) {
    // Sprint-specific JQL can fail on Kanban boards — retry with fallback
    if (fallbackJql && e instanceof Error && (e.message.includes('400') || e.message.includes('openSprints'))) {
      return fetchAllWithJql(host, fallbackJql);
    }
    throw e;
  }
}

export function parseErrorHint(message: string): string {
  if (message.includes('401')) {
    return 'Your session expired. Sign in again with Atlassian.';
  }
  if (message.includes('403')) {
    return "Your account doesn't have access to this Jira site.";
  }
  return '';
}

export interface AuthUser {
  userName?: string;
  userEmail?: string;
}

export async function fetchAuthUser(): Promise<AuthUser | null> {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) return null;
  const data = await res.json();
  return data.authenticated
    ? { userName: data.userName, userEmail: data.userEmail }
    : null;
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
}
