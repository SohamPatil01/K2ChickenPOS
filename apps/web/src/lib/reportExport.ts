export type CellAlign = 'left' | 'right' | 'center';

export type ExportRow =
  | { kind: 'section'; label: string }
  | { kind: 'data'; cells: (string | number | null | undefined)[]; bold?: boolean };

export interface ReportTable {
  title?: string;
  headers: string[];
  headerAlign?: CellAlign[];
  columnAlign?: CellAlign[];
  rows: ExportRow[];
}

export interface StyledReportOptions {
  title: string;
  filename: string;
  period?: string;
  generatedAt?: Date;
  summary?: { label: string; value: string }[];
  tables: ReportTable[];
}

const BRAND = '#FF6A00';
const BRAND_LIGHT = '#FFF0E6';
const BRAND_DARK = '#7A2E00';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatReportPeriod(start?: string, end?: string): string | undefined {
  if (!start && !end) return undefined;
  if (start && end) return `${formatDisplayDate(start)} – ${formatDisplayDate(end)}`;
  return start ? formatDisplayDate(start) : formatDisplayDate(end!);
}

export function formatDisplayDate(value: string | Date): string {
  const d =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? (() => {
          const [y, m, day] = value.split('-').map(Number);
          return new Date(y, m - 1, day);
        })()
      : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatCurrency(amount: number | null | undefined): string {
  const n = Number(amount) || 0;
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function alignStyle(align?: CellAlign): string {
  if (align === 'right') return 'text-align:right;';
  if (align === 'center') return 'text-align:center;';
  return 'text-align:left;';
}

function renderSummary(summary: { label: string; value: string }[]): string {
  if (!summary.length) return '';
  const cards = summary
    .map(
      (item) => `
        <td style="padding:12px 16px;background:${BRAND_LIGHT};border:1px solid #FFD5B3;border-radius:8px;vertical-align:top;">
          <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">${escapeHtml(item.label)}</div>
          <div style="font-size:18px;font-weight:700;color:${BRAND_DARK};">${escapeHtml(item.value)}</div>
        </td>`
    )
    .join('');
  return `
    <table style="width:100%;border-collapse:separate;border-spacing:10px 0;margin:0 0 20px 0;">
      <tr>${cards}</tr>
    </table>`;
}

function renderTable(table: ReportTable, tableIndex: number): string {
  const colCount = table.headers.length;
  const headerCells = table.headers
    .map(
      (h, i) =>
        `<th style="padding:10px 12px;background:${BRAND};color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;border:1px solid #E65C00;${alignStyle(table.headerAlign?.[i] || table.columnAlign?.[i])}">${escapeHtml(h)}</th>`
    )
    .join('');

  const bodyRows = table.rows
    .map((row, rowIndex) => {
      if (row.kind === 'section') {
        return `
          <tr>
            <td colspan="${colCount}" style="padding:10px 12px;background:${BRAND_LIGHT};color:${BRAND_DARK};font-weight:700;font-size:13px;border:1px solid #FFD5B3;">
              ${escapeHtml(row.label)}
            </td>
          </tr>`;
      }

      const bg = rowIndex % 2 === 0 ? '#ffffff' : '#FAFAFA';
      const cells = row.cells
        .map((cell, i) => {
          const isNum = typeof cell === 'number';
          return `<td style="padding:8px 12px;border:1px solid #E5E7EB;background:${bg};font-size:12px;${alignStyle(table.columnAlign?.[i])}${row.bold ? 'font-weight:700;' : ''}${isNum ? 'mso-number-format:General;' : ''}">${escapeHtml(cell ?? '—')}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const titleBlock = table.title
    ? `<h2 style="margin:24px 0 10px 0;font-size:15px;color:${BRAND_DARK};">${escapeHtml(table.title)}</h2>`
    : tableIndex > 0
      ? '<div style="height:16px;"></div>'
      : '';

  return `
    ${titleBlock}
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>`;
}

function buildReportHtml(options: StyledReportOptions): string {
  const generated = (options.generatedAt ?? new Date()).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const metaRows = [
    options.period ? `<tr><td style="color:#666;padding:2px 0;">Period</td><td style="padding:2px 0;font-weight:600;">${escapeHtml(options.period)}</td></tr>` : '',
    `<tr><td style="color:#666;padding:2px 0;">Generated</td><td style="padding:2px 0;">${escapeHtml(generated)}</td></tr>`,
  ].join('');

  const tablesHtml = options.tables.map((t, i) => renderTable(t, i)).join('');

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
  <meta charset="utf-8" />
  <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Report</x:Name></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
  <style>
    body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; color: #1f2937; margin: 24px; }
    table { mso-displayed-decimal-separator: "."; mso-displayed-thousand-separator: ","; }
  </style>
</head>
<body>
  <div style="border-bottom:4px solid ${BRAND};padding-bottom:12px;margin-bottom:20px;">
    <div style="font-size:11px;color:${BRAND};font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px;">K2 Chicken POS</div>
    <h1 style="margin:0;font-size:22px;color:${BRAND_DARK};">${escapeHtml(options.title)}</h1>
    <table style="margin-top:10px;font-size:12px;border-collapse:collapse;">${metaRows}</table>
  </div>
  ${renderSummary(options.summary || [])}
  ${tablesHtml}
  <p style="margin-top:24px;font-size:10px;color:#9CA3AF;">Exported from K2 Chicken POS Reports</p>
</body>
</html>`;
}

/** Download a styled Excel-compatible report (.xls) that matches on-screen layout. */
export function downloadStyledReport(options: StyledReportOptions): void {
  const html = buildReportHtml(options);
  const blob = new Blob(['\ufeff', html], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = options.filename.endsWith('.xls') ? options.filename : `${options.filename}.xls`;
  a.click();
  window.URL.revokeObjectURL(url);
}

/** Simple single-table helper. */
export function downloadReportTable(
  title: string,
  filename: string,
  opts: {
    period?: string;
    summary?: { label: string; value: string }[];
    headers: string[];
    headerAlign?: CellAlign[];
    columnAlign?: CellAlign[];
    rows: ExportRow[];
    tableTitle?: string;
  }
): void {
  downloadStyledReport({
    title,
    filename,
    period: opts.period,
    summary: opts.summary,
    tables: [
      {
        title: opts.tableTitle,
        headers: opts.headers,
        headerAlign: opts.headerAlign,
        columnAlign: opts.columnAlign,
        rows: opts.rows,
      },
    ],
  });
}
