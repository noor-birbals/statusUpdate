import { NextRequest, NextResponse } from 'next/server';
import { getValidSession } from '@/lib/atlassian-oauth';
import { JIRA_FIELDS } from '@/lib/constants';
import {
  getStoryPointFieldIds,
  normalizeIssueStoryPoints,
} from '@/lib/jira-story-points-server';

export async function POST(request: NextRequest) {
  const session = await getValidSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
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

  const cloudId = session.cloudIds[host];
  if (!cloudId) {
    return NextResponse.json(
      { error: `No access to ${host}. Sign in with an account that has access to this site.` },
      { status: 403 },
    );
  }

  const storyPointFieldIds = await getStoryPointFieldIds(cloudId, session.accessToken, host);
  const fields = [...new Set([...JIRA_FIELDS, ...storyPointFieldIds])];

  const jiraBody: Record<string, unknown> = {
    jql,
    maxResults,
    fields,
  };
  if (nextPageToken) jiraBody.nextPageToken = nextPageToken;

  const jiraRes = await fetch(
    `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(jiraBody),
    },
  );

  const text = await jiraRes.text();
  if (!jiraRes.ok) {
    return new NextResponse(text, {
      status: jiraRes.status,
      headers: { 'Content-Type': jiraRes.headers.get('content-type') || 'application/json' },
    });
  }

  try {
    const data = JSON.parse(text) as {
      issues?: Array<{ key: string; fields: Record<string, unknown> }>;
      [key: string]: unknown;
    };

    if (data.issues) {
      data.issues = data.issues.map((issue) =>
        normalizeIssueStoryPoints(issue, storyPointFieldIds),
      );
    }

    return NextResponse.json(data);
  } catch {
    return new NextResponse(text, {
      status: jiraRes.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
