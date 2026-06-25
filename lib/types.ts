export interface SprintInfo {
  id: number;
  name: string;
  state: string;
  startDate?: string;
  endDate?: string;
}

export interface JiraIssue {
  key: string;
  fields: {
    summary?: string;
    status?: { name: string };
    assignee?: { displayName: string } | null;
    issuetype?: { name: string };
    project?: { name?: string; key?: string };
    priority?: { name: string };
    updated?: string;
    storyPoints?: number;
    sprint?: SprintInfo | null;
    parent?: { key: string; fields?: { summary?: string; issuetype?: { name: string } } } | null;
  };
}

export interface JiraSearchResponse {
  issues?: JiraIssue[];
  nextPageToken?: string;
  isLast?: boolean;
}

export type StatusCategory =
  | 'done'
  | 'inprogress'
  | 'review'
  | 'todo'
  | 'blocked'
  | 'cancelled'
  | 'codereview'
  | 'qa';

export interface Blocker {
  key: string;
  summary: string;
  status: string;
  assignee: string;
}

export interface BoardStats {
  total: number;
  done: number;
  inprog: number;
  review: number;
  blocked: number;
  todo: number;
  cancelled: number;
  pct: number;
  statusCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  projectCounts: Record<string, number>;
  assigneeCounts: Record<string, number>;
  assigneeStackData: Record<string, Record<string, number>>;
  blockers: Blocker[];
}
