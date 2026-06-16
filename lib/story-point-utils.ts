export function parseStoryPointValue(val: unknown): number {
  if (val == null || val === '') return 0;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val === 'string') {
    const n = parseFloat(val);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

export function formatStoryPoints(points: number): string {
  if (points === 0) return '0';
  if (Number.isInteger(points)) return String(points);
  return Number(points.toFixed(1)).toString();
}
