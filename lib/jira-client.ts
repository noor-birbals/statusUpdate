import { JQL } from './constants';
import type { JiraIssue, JiraSearchResponse } from './types';

function basicAuth(email: string, token: string): string {
  return `Basic ${btoa(`${email}:${token}`)}`;
}

export async function fetchAllIssues(host: string, email: string, token: string): Promise<JiraIssue[]> {
  const auth = basicAuth(email, token);
  const all: JiraIssue[] = [];
  let nextPageToken: string | undefined;

  while (true) {
    const res = await fetch('/api/jira/search', {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ host, jql: JQL, nextPageToken, maxResults: 100 }),
    });

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
    return 'Check your email and API token in Settings.';
  }
  if (message.includes('403')) {
    return "Your account doesn't have access to this Jira site.";
  }
  return '';
}
