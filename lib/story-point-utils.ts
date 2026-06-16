const MAX_STORY_POINTS = 100;

/** Only accept plain numeric story point values — never parse dates like "2026-06-16". */
export function parseStoryPointValue(val: unknown): number {
  if (val == null || val === '') return 0;

  if (typeof val === 'number') {
    if (Number.isNaN(val) || val < 0 || val > MAX_STORY_POINTS) return 0;
    return val;
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return 0;
    // Reject ISO dates and any string with date/time separators
    if (/[-T:/]/.test(trimmed)) return 0;
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return 0;
    const n = parseFloat(trimmed);
    if (Number.isNaN(n) || n < 0 || n > MAX_STORY_POINTS) return 0;
    return n;
  }

  return 0;
}

export function formatStoryPoints(points: number): string {
  if (points === 0) return '0';
  if (Number.isInteger(points)) return String(points);
  // Preserve values like 0.25 — show up to 2 decimals, trim trailing zeros
  return parseFloat(points.toFixed(2)).toString();
}

export function issueTypeHasStoryPoints(issueTypeName?: string): boolean {
  const type = (issueTypeName || '').toLowerCase().trim();
  if (!type) return true;
  const excluded = ['bug', 'sub-task', 'subtask', 'sub task', 'epic'];
  return !excluded.some((t) => type === t || type.includes(t));
}
