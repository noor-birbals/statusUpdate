import { JQL } from './constants';
import type { JiraIssue, JiraSearchResponse } from './types';

export async function fetchAllIssues(host: string): Promise<JiraIssue[]> {
  const all: JiraIssue[] = [];
  let nextPageToken: string | undefined;

  while (true) {
    const res = await fetch('/api/jira/search', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host, jql: JQL, nextPageToken, maxResults: 100 }),
    });

    if (res.status === 401) {
      throw new Error('401 Unauthorized — please sign in again.');
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`${res.status} ${res.statusText}${body ? ': ' + body.slice(0, 200) : ''}`);
    }

    const data: JiraSearchResponse = await res.json();
    all.push(...(data.issues || []));

    if (data.isLast || !data.nextPageToken || (data.issues || []).length === 0) break;
    nextPageToken = data.nextPageToken;
  }

  return all;
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
