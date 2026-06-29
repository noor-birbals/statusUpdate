import { NextRequest, NextResponse } from 'next/server';
import { getValidSession } from '@/lib/atlassian-oauth';
import type { SprintInfo } from '@/lib/types';

interface JiraBoard {
  id: number;
  name: string;
  type: string;
}

interface JiraSprint {
  id: number;
  name: string;
  state: string;
  startDate?: string;
  endDate?: string;
}

async function getBoards(cloudId: string, token: string, projectKey: string): Promise<JiraBoard[]> {
  const res = await fetch(
    `https://api.atlassian.com/ex/jira/${cloudId}/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(projectKey)}&maxResults=10`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.values as JiraBoard[]) || [];
}

async function getBoardSprints(cloudId: string, token: string, boardId: number): Promise<JiraSprint[]> {
  const res = await fetch(
    `https://api.atlassian.com/ex/jira/${cloudId}/rest/agile/1.0/board/${boardId}/sprint?state=active,closed&maxResults=20`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.values as JiraSprint[]) || [];
}

export async function GET(request: NextRequest) {
  const session = await getValidSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const host = searchParams.get('host');
  const projectKey = searchParams.get('projectKey');

  if (!host || !/^[a-z0-9.-]+\.atlassian\.net$/i.test(host)) {
    return NextResponse.json({ error: 'Invalid host' }, { status: 400 });
  }
  if (!projectKey) {
    return NextResponse.json({ error: 'Missing projectKey' }, { status: 400 });
  }

  const cloudId = session.cloudIds[host];
  if (!cloudId) {
    return NextResponse.json({ error: `No access to ${host}` }, { status: 403 });
  }

  const boards = await getBoards(cloudId, session.accessToken, projectKey);
  if (!boards.length) return NextResponse.json({ sprints: [] });

  // Collect sprints from all boards, deduplicate by id
  const seen = new Set<number>();
  const allSprints: SprintInfo[] = [];

  for (const board of boards) {
    const sprints = await getBoardSprints(cloudId, session.accessToken, board.id);
    for (const s of sprints) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        allSprints.push({ id: s.id, name: s.name, state: s.state, startDate: s.startDate, endDate: s.endDate });
      }
    }
  }

  // Sort: active first, then closed by endDate desc (most recent first)
  allSprints.sort((a, b) => {
    if (a.state === 'active' && b.state !== 'active') return -1;
    if (b.state === 'active' && a.state !== 'active') return 1;
    return (b.endDate || '').localeCompare(a.endDate || '');
  });

  return NextResponse.json({ sprints: allSprints });
}
