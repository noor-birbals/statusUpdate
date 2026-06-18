import type { JiraIssue } from './types';

export interface DashboardFilters {
  assignee: string;
  issueType: string;
  statuses: string[];
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_FILTERS: DashboardFilters = {
  assignee: '',
  issueType: '',
  statuses: [],
  dateFrom: '',
  dateTo: '',
};

export function getAssignees(issues: JiraIssue[]): string[] {
  const names = new Set(issues.map((i) => i.fields.assignee?.displayName || 'Unassigned'));
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

export function getIssueTypes(issues: JiraIssue[]): string[] {
  const types = new Set(issues.map((i) => i.fields.issuetype?.name || 'Other'));
  return Array.from(types).sort((a, b) => a.localeCompare(b));
}

export function getStatuses(issues: JiraIssue[]): string[] {
  const statuses = new Set(issues.map((i) => i.fields.status?.name || 'Unknown'));
  return Array.from(statuses).sort((a, b) => a.localeCompare(b));
}

export function filterIssues(issues: JiraIssue[], filters: DashboardFilters): JiraIssue[] {
  return issues.filter((issue) => {
    if (filters.assignee) {
      const name = issue.fields.assignee?.displayName || 'Unassigned';
      if (name !== filters.assignee) return false;
    }

    if (filters.issueType) {
      const type = issue.fields.issuetype?.name || 'Other';
      if (type !== filters.issueType) return false;
    }

    if (filters.statuses.length > 0) {
      const status = issue.fields.status?.name || 'Unknown';
      if (!filters.statuses.includes(status)) return false;
    }

    if (filters.dateFrom || filters.dateTo) {
      const updated = issue.fields.updated;
      if (!updated) return false;
      const day = updated.slice(0, 10);
      if (filters.dateFrom && day < filters.dateFrom) return false;
      if (filters.dateTo && day > filters.dateTo) return false;
    }

    return true;
  });
}

export function hasActiveFilters(filters: DashboardFilters): boolean {
  return Boolean(
    filters.assignee ||
      filters.issueType ||
      filters.statuses.length > 0 ||
      filters.dateFrom ||
      filters.dateTo,
  );
}
