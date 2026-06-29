export const BOARDS = {
  mic: {
    label: 'Micurato',
    host: 'micurato.atlassian.net',
    jql: 'sprint in openSprints() ORDER BY assignee ASC',
    fallbackJql: 'assignee is not EMPTY AND statusCategory != Done ORDER BY updated DESC',
  },
  bib: {
    label: 'Birbals',
    host: 'birbals.atlassian.net',
    jql: 'sprint in openSprints() ORDER BY assignee ASC',
    fallbackJql: 'assignee is not EMPTY AND statusCategory != Done ORDER BY updated DESC',
  },
} as const;

export type BoardId = keyof typeof BOARDS;

/** @deprecated use BOARDS[id].jql instead */
export const JQL = 'sprint in openSprints() ORDER BY assignee ASC';

/** Story points custom field — override via JIRA_STORY_POINTS_FIELD in .env.local */
export const STORY_POINTS_FIELD =
  process.env.JIRA_STORY_POINTS_FIELD || 'customfield_10032';

export const SPRINT_FIELD = 'customfield_10020';

export const JIRA_FIELDS = [
  'summary',
  'status',
  'assignee',
  'issuetype',
  'project',
  'priority',
  'updated',
  'parent',
  SPRINT_FIELD,
] as const;

export const PALETTE = [
  '#0052CC', '#00875A', '#FF8B00', '#6554C0', '#DE350B',
  '#008DA6', '#403294', '#0065FF', '#36B37E', '#FFAB00',
  '#57D9A3', '#FF5630', '#6B778C', '#00B8D9', '#97A0AF',
];
