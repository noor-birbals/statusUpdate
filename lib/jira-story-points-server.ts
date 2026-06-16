import { STORY_POINT_FIELD_KEYS } from './constants';
import { parseStoryPointValue } from './story-point-utils';

interface JiraFieldMeta {
  id: string;
  name: string;
  custom?: boolean;
  schema?: { type?: string };
}

const fieldCache = new Map<string, string[]>();

export async function getStoryPointFieldIds(
  cloudId: string,
  accessToken: string,
  host: string,
): Promise<string[]> {
  const cached = fieldCache.get(host);
  if (cached) return cached;

  const defaults = [...STORY_POINT_FIELD_KEYS];

  try {
    const res = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/field`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });

    if (!res.ok) {
      fieldCache.set(host, defaults);
      return defaults;
    }

    const fields = (await res.json()) as JiraFieldMeta[];
    const discovered = fields
      .filter((f) => {
        const name = f.name.toLowerCase();
        if (!/story\s*point/.test(name)) return false;
        if (/epic|sum|Σ|progress/.test(name)) return false;
        return true;
      })
      .map((f) => f.id);

    const ids = [...new Set([...discovered, ...defaults])];
    fieldCache.set(host, ids);
    return ids;
  } catch {
    fieldCache.set(host, defaults);
    return defaults;
  }
}

export function extractStoryPoints(
  fields: Record<string, unknown>,
  fieldIds: string[],
): number {
  if (fields.storyPoints != null) {
    return parseStoryPointValue(fields.storyPoints);
  }

  for (const id of fieldIds) {
    const val = parseStoryPointValue(fields[id]);
    if (val > 0) return val;
  }

  for (const id of fieldIds) {
    const val = parseStoryPointValue(fields[id]);
    if (val !== 0) return val;
  }

  return 0;
}

export function normalizeIssueStoryPoints(
  issue: { key: string; fields: Record<string, unknown> },
  fieldIds: string[],
) {
  const points = extractStoryPoints(issue.fields, fieldIds);
  issue.fields.storyPoints = points;
  return issue;
}
