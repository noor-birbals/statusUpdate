import { parseStoryPointValue, issueTypeHasStoryPoints } from './story-point-utils';

interface JiraFieldMeta {
  id: string;
  name: string;
  custom?: boolean;
  schema?: { type?: string };
}

const fieldCache = new Map<string, string | null>();

function pickStoryPointField(fields: JiraFieldMeta[]): string | null {
  const envField = process.env.JIRA_STORY_POINTS_FIELD;
  if (envField) return envField;

  const candidates = fields.filter((f) => {
    const name = f.name.toLowerCase();
    if (!/story\s*point/.test(name)) return false;
    if (/epic|sum|Σ|progress|burn|change/.test(name)) return false;
    const type = f.schema?.type;
    if (type && !['number', 'float', 'integer'].includes(type)) return false;
    return true;
  });

  const exact = candidates.find((f) => f.name.toLowerCase() === 'story points');
  if (exact) return exact.id;

  const estimate = candidates.find((f) =>
    f.name.toLowerCase().includes('story point estimate'),
  );
  if (estimate) return estimate.id;

  return candidates[0]?.id ?? null;
}

export async function getStoryPointFieldId(
  cloudId: string,
  accessToken: string,
  host: string,
): Promise<string | null> {
  if (fieldCache.has(host)) return fieldCache.get(host)!;

  try {
    const res = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/field`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });

    if (!res.ok) {
      fieldCache.set(host, null);
      return null;
    }

    const fields = (await res.json()) as JiraFieldMeta[];
    const id = pickStoryPointField(fields);
    fieldCache.set(host, id);
    return id;
  } catch {
    fieldCache.set(host, null);
    return null;
  }
}

export function extractStoryPoints(
  fields: Record<string, unknown>,
  fieldId: string | null,
): number {
  const issueType = (fields.issuetype as { name?: string } | undefined)?.name;
  if (!issueTypeHasStoryPoints(issueType)) return 0;
  if (!fieldId) return 0;

  return parseStoryPointValue(fields[fieldId]);
}

export function normalizeIssueStoryPoints(
  issue: { key: string; fields: Record<string, unknown> },
  fieldId: string | null,
) {
  issue.fields.storyPoints = extractStoryPoints(issue.fields, fieldId);
  return issue;
}
