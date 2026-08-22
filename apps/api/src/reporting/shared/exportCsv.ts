// @ts-nocheck

export function escapeCsvCell(value: unknown): string {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(','));
  }
  return lines.join('\n');
}

export function csvResponse(csv: string, filename: string) {
  return {
    contentType: 'text/csv; charset=utf-8',
    disposition: `attachment; filename="${filename}"`,
    body: csv,
  };
}
