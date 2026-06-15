export const BOARDS = {
  mic: { label: 'Micurato', host: 'micurato.atlassian.net' },
  bib: { label: 'Birbals', host: 'birbals.atlassian.net' },
} as const;

export type BoardId = keyof typeof BOARDS;

export const JQL = 'sprint in openSprints() ORDER BY assignee ASC';

export const JIRA_FIELDS = [
  'summary',
  'status',
  'assignee',
  'issuetype',
  'project',
  'priority',
] as const;

export const PALETTE = [
  '#0052CC', '#00875A', '#FF8B00', '#6554C0', '#DE350B',
  '#008DA6', '#403294', '#0065FF', '#36B37E', '#FFAB00',
  '#57D9A3', '#FF5630', '#6B778C', '#00B8D9', '#97A0AF',
];
