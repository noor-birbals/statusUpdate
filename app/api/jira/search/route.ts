import { NextRequest, NextResponse } from 'next/server';
import { JIRA_FIELDS } from '@/lib/constants';

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!auth) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  let body: { host?: string; jql?: string; nextPageToken?: string; maxResults?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { host, jql, nextPageToken, maxResults = 100 } = body;

  if (!host || !/^[a-z0-9.-]+\.atlassian\.net$/i.test(host)) {
    return NextResponse.json({ error: 'Invalid Jira host' }, { status: 400 });
  }
  if (!jql) {
    return NextResponse.json({ error: 'Missing jql' }, { status: 400 });
  }

  const jiraBody: Record<string, unknown> = {
    jql,
    maxResults,
    fields: [...JIRA_FIELDS],
  };
  if (nextPageToken) jiraBody.nextPageToken = nextPageToken;

  const jiraRes = await fetch(`https://${host}/rest/api/3/search/jql`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(jiraBody),
  });

  const text = await jiraRes.text();
  return new NextResponse(text, {
    status: jiraRes.status,
    headers: { 'Content-Type': jiraRes.headers.get('content-type') || 'application/json' },
  });
}
