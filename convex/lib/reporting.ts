export const reportDateTypes = [
  "created",
  "required",
  "assigned",
  "purchased",
  "received",
  "confirmed",
  "completed",
] as const;

export type ReportDateType = (typeof reportDateTypes)[number];

export function safeAverage(values: number[]) {
  if (!values.length) return null;
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

export function sanitizeCsvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function csvRow(values: unknown[]) {
  return values.map(sanitizeCsvCell).join(",");
}

export function withinRange(
  value: number | undefined,
  from?: number,
  to?: number,
) {
  if (value === undefined) return false;
  if (from !== undefined && value < from) return false;
  if (to !== undefined && value > to) return false;
  return true;
}
