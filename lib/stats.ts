import type { BoardStats, JiraIssue, StatusCategory } from './types';

export function classify(status: string): StatusCategory {
  const s = (status || '').toLowerCase();
  if (['done', 'closed', 'verification passed', 'deploy on live'].some((k) => s.includes(k))) return 'done';
  if (['cancelled', 'cancel'].some((k) => s.includes(k))) return 'cancelled';
  if (['on hold', 'on-hold', 'blocked'].some((k) => s.includes(k))) return 'blocked';
  if (['code review', 'in code review'].some((k) => s.includes(k))) return 'codereview';
  if (['ready for qa'].some((k) => s.includes(k))) return 'qa';
  if (['test', 'testing', 'verification', 'in review', 'review'].some((k) => s.includes(k))) return 'review';
  if (['in progress', 'in-progress', 'development in progress', 'dev in progress'].some((k) => s.includes(k))) return 'inprogress';
  return 'todo';
}

export function badgeClass(cat: StatusCategory): string {
  const map: Record<StatusCategory, string> = {
    done: 'b-done',
    inprogress: 'b-prog',
    todo: 'b-todo',
    review: 'b-review',
    blocked: 'b-blocked',
    cancelled: 'b-cancel',
    codereview: 'b-prog',
    qa: 'b-review',
  };
  return map[cat] || 'b-todo';
}

export function avatarBg(name: string, palette: readonly string[]): string {
  let h = 0;
  for (const c of name || '?') h = (h * 31 + c.charCodeAt(0)) & 0xffffff;
  return palette[Math.abs(h) % palette.length];
}

export function initials(name: string): string {
  return (name || '?')
    .split(' ')
    .map((w) => w[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function aggregateIssues(issues: JiraIssue[]): BoardStats {
  const statusCounts: Record<string, number> = {};
  const assigneeCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  const projectCounts: Record<string, number> = {};
  const cats = { done: 0, inprogress: 0, review: 0, todo: 0, blocked: 0, cancelled: 0, codereview: 0, qa: 0 };
  const blockers: BoardStats['blockers'] = [];
  const assigneeStackData: Record<string, Record<string, number>> = {};

  for (const issue of issues) {
    const f = issue.fields || {};
    const status = f.status?.name || 'Unknown';
    const assignee = f.assignee?.displayName || 'Unassigned';
    const type = f.issuetype?.name || 'Other';
    const project = f.project?.name || f.project?.key || 'Unknown';
    const cat = classify(status);

    statusCounts[status] = (statusCounts[status] || 0) + 1;
    assigneeCounts[assignee] = (assigneeCounts[assignee] || 0) + 1;
    typeCounts[type] = (typeCounts[type] || 0) + 1;
    projectCounts[project] = (projectCounts[project] || 0) + 1;
    cats[cat] = (cats[cat] || 0) + 1;

    if (!assigneeStackData[assignee]) {
      assigneeStackData[assignee] = { done: 0, inprogress: 0, review: 0, todo: 0, blocked: 0 };
    }
    const mc = ['review', 'codereview', 'qa'].includes(cat)
      ? 'review'
      : ['done', 'inprogress', 'todo', 'blocked'].includes(cat)
        ? cat
        : 'todo';
    assigneeStackData[assignee][mc]++;

    if (cat === 'blocked') {
      blockers.push({ key: issue.key, summary: f.summary || '', status, assignee });
    }
  }

  const total = issues.length;
  const done = cats.done;
  const inprog = cats.inprogress + cats.codereview;
  const review = cats.review + cats.qa;
  const blocked = cats.blocked;
  const todo = cats.todo;
  const cancelled = cats.cancelled;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return {
    total,
    done,
    inprog,
    review,
    blocked,
    todo,
    cancelled,
    pct,
    statusCounts,
    typeCounts,
    projectCounts,
    assigneeCounts,
    assigneeStackData,
    blockers,
  };
}
