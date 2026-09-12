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

export type ServerStatus = 'active' | 'flagged' | 'done';

// Which company actually hosts the physical/virtual machine. Optional and
// manually set (or auto-set to 'linode' by the Linode sync) since there's
// no API to confirm this for providers other than Linode.
export type ServerProvider = 'linode' | 'ioflood';

export interface ServerEntry {
  id: string;
  name: string;
  ip: string;
  hostname?: string;
  os?: string;
  status: ServerStatus;
  linodeLabel?: string;
  plan?: string;
  region?: string;
  lastBackup?: string;
  disk?: string;
  mem?: string;
  websites?: string[];
  databases?: string[];
  findings?: string[];
  desc?: string;
  backup?: string;
  flagNote?: string;
  notes?: string;
  linodeStatus?: string;
  linodeSyncedAt?: string;
  cpuPct?: number;
  provider?: ServerProvider;
  updatedAt: string;
}
