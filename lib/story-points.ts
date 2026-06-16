import { STORY_POINT_FIELD_KEYS } from './constants';
import { parseStoryPointValue, formatStoryPoints } from './story-point-utils';
import type { JiraIssue } from './types';

export { formatStoryPoints };

export interface AssigneeStoryPoints {
  assignee: string;
  points: number;
  issues: number;
}

export function getStoryPoints(issue: JiraIssue): number {
  const fields = issue.fields as Record<string, unknown>;

  if (fields.storyPoints != null) {
    return parseStoryPointValue(fields.storyPoints);
  }

  for (const key of STORY_POINT_FIELD_KEYS) {
    const val = parseStoryPointValue(fields[key]);
    if (val > 0) return val;
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
      points: Math.round(data.points * 10) / 10,
      issues: data.issues,
    }))
    .sort((a, b) => b.points - a.points || a.assignee.localeCompare(b.assignee));
}

export function getTotalStoryPoints(issues: JiraIssue[]): number {
  const total = issues.reduce((sum, issue) => sum + getStoryPoints(issue), 0);
  return Math.round(total * 10) / 10;
}
