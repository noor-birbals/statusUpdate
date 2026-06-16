import { parseStoryPointValue, formatStoryPoints, issueTypeHasStoryPoints } from './story-point-utils';
import type { JiraIssue } from './types';

export { formatStoryPoints };

export interface AssigneeStoryPoints {
  assignee: string;
  points: number;
  issues: number;
}

export function getStoryPoints(issue: JiraIssue): number {
  if (!issueTypeHasStoryPoints(issue.fields.issuetype?.name)) return 0;

  const fields = issue.fields as Record<string, unknown>;
  if (fields.storyPoints != null) {
    return parseStoryPointValue(fields.storyPoints);
  }

  return 0;
}

export function getStoryPointsByAssignee(issues: JiraIssue[]): AssigneeStoryPoints[] {
  const map: Record<string, { points: number; issues: number }> = {};

  for (const issue of issues) {
    const assignee = issue.fields.assignee?.displayName || 'Unassigned';
    if (!map[assignee]) map[assignee] = { points: 0, issues: 0 };
    map[assignee].points += getStoryPoints(issue);
    map[assignee].issues += 1;
  }

  return Object.entries(map)
    .map(([assignee, data]) => ({
      assignee,
      points: data.points,
      issues: data.issues,
    }))
    .sort((a, b) => b.points - a.points || a.assignee.localeCompare(b.assignee));
}

export function getTotalStoryPoints(issues: JiraIssue[]): number {
  return issues.reduce((sum, issue) => sum + getStoryPoints(issue), 0);
}
