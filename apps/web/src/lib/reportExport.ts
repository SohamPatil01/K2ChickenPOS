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

/** Excel-safe text: ASCII currency, no special dashes. */
function excelText(value: unknown): string {
  return String(value ?? '')
    .replace(/₹/g, 'Rs ')
    .replace(/–/g, '-')
    .replace(/—/g, '-');
}

function escapeHtml(value: unknown): string {
  return excelText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvEscape(value: unknown): string {
  const s = excelText(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function formatReportPeriod(start?: string, end?: string): string | undefined {
  if (!start && !end) return undefined;
  if (start && end) return `${formatDisplayDate(start)} - ${formatDisplayDate(end)}`;
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
  return `Rs ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function alignStyle(align?: CellAlign): string {
  if (align === 'right') return 'text-align:right;';
  if (align === 'center') return 'text-align:center;';
  return 'text-align:left;';
}

/** Summary as a simple Excel-friendly table (no nested divs / border-radius). */
function renderSummary(summary: { label: string; value: string }[]): string {
  if (!summary.length) return '';
  const rows = summary
    .map(
      (item) =>
        `<tr>
          <td style="padding:6px 10px;background:${BRAND_LIGHT};border:1px solid #FFD5B3;font-weight:600;">${escapeHtml(item.label)}</td>
          <td style="padding:6px 10px;background:${BRAND_LIGHT};border:1px solid #FFD5B3;">${escapeHtml(item.value)}</td>
        </tr>`
    )
    .join('');
  return `<table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:16px;">${rows}</table>`;
}

function renderTable(table: ReportTable, tableIndex: number): string {
  const colCount = table.headers.length;
  const headerCells = table.headers
    .map(
      (h, i) =>
        `<th style="padding:8px 10px;background:${BRAND};color:#ffffff;font-weight:bold;border:1px solid #E65C00;${alignStyle(table.headerAlign?.[i] || table.columnAlign?.[i])}">${escapeHtml(h)}</th>`
    )
    .join('');

  const bodyRows = table.rows
    .map((row, rowIndex) => {
      if (row.kind === 'section') {
        return `
          <tr>
            <td colspan="${colCount}" style="padding:8px 10px;background:${BRAND_LIGHT};color:${BRAND_DARK};font-weight:bold;border:1px solid #FFD5B3;">
              ${escapeHtml(row.label)}
            </td>
          </tr>`;
      }

      const bg = rowIndex % 2 === 0 ? '#ffffff' : '#f9fafb';
      const cells = row.cells
        .map((cell, i) => {
          const text = cell === null || cell === undefined || cell === '' ? '-' : cell;
          return `<td style="padding:6px 10px;border:1px solid #d1d5db;background:${bg};${alignStyle(table.columnAlign?.[i])}${row.bold ? 'font-weight:bold;' : ''}">${escapeHtml(text)}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const titleBlock = table.title
    ? `<tr><td colspan="${colCount}" style="padding:10px 0 6px 0;font-size:14px;font-weight:bold;color:${BRAND_DARK};border:none;">${escapeHtml(table.title)}</td></tr>`
    : tableIndex > 0
      ? `<tr><td colspan="${colCount}" style="height:12px;border:none;"></td></tr>`
      : '';

  return `
    <table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin-bottom:12px;">
      ${titleBlock ? `<tbody>${titleBlock}</tbody>` : ''}
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows || `<tr><td colspan="${colCount}" style="padding:8px;">No data</td></tr>`}</tbody>
    </table>`;
}

function buildReportHtml(options: StyledReportOptions): string {
  const generated = excelText(
    (options.generatedAt ?? new Date()).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  );

  const metaRows = [
    options.period
      ? `<tr><td style="padding:4px 8px;color:#666;">Period</td><td style="padding:4px 8px;font-weight:bold;">${escapeHtml(options.period)}</td></tr>`
      : '',
    `<tr><td style="padding:4px 8px;color:#666;">Generated</td><td style="padding:4px 8px;">${escapeHtml(generated)}</td></tr>`,
  ].join('');

  const tablesHtml = options.tables.map((t, i) => renderTable(t, i)).join('');

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <!--[if gte mso 9]><xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>Report</x:Name>
          <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml><![endif]-->
</head>
<body>
  <table border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:16px;width:100%;">
    <tr>
      <td style="border-bottom:3px solid ${BRAND};padding-bottom:10px;">
        <span style="font-size:11px;color:${BRAND};font-weight:bold;">K2 Chicken POS</span><br/>
        <span style="font-size:20px;font-weight:bold;color:${BRAND_DARK};">${escapeHtml(options.title)}</span>
        <table border="0" cellpadding="0" cellspacing="0" style="margin-top:8px;">${metaRows}</table>
      </td>
    </tr>
  </table>
  ${renderSummary(options.summary || [])}
  ${tablesHtml}
  <table border="0"><tr><td style="padding-top:16px;font-size:10px;color:#9ca3af;">Exported from K2 Chicken POS Reports</td></tr></table>
</body>
</html>`;
}

function buildReportCsv(options: StyledReportOptions): string {
  const lines: string[] = [];
  lines.push(csvEscape('K2 Chicken POS'));
  lines.push(csvEscape(options.title));
  if (options.period) lines.push(`${csvEscape('Period')},${csvEscape(options.period)}`);
  lines.push(
    `${csvEscape('Generated')},${csvEscape(
      (options.generatedAt ?? new Date()).toLocaleString('en-IN')
    )}`
  );
  lines.push('');

  for (const item of options.summary || []) {
    lines.push(`${csvEscape(item.label)},${csvEscape(item.value)}`);
  }
  if ((options.summary || []).length) lines.push('');

  for (const table of options.tables) {
    if (table.title) {
      lines.push(csvEscape(table.title));
    }
    lines.push(table.headers.map(csvEscape).join(','));
    for (const row of table.rows) {
      if (row.kind === 'section') {
        lines.push(csvEscape(row.label));
        continue;
      }
      lines.push(row.cells.map(csvEscape).join(','));
    }
    lines.push('');
  }

  return lines.join('\r\n');
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after the browser has time to start the download (immediate revoke causes blank files).
  window.setTimeout(() => window.URL.revokeObjectURL(url), 2000);
}

/** Download styled report as .xls (Excel HTML) — opens in Excel and browsers. */
export function downloadStyledReport(options: StyledReportOptions): void {
  const base = options.filename.replace(/\.(xls|xlsx|csv|html)$/i, '');
  const html = buildReportHtml(options);
  const blob = new Blob(['\ufeff', html], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  });
  triggerDownload(blob, `${base}.xls`);
}

/** Download plain CSV (most compatible with Excel / Google Sheets). */
export function downloadReportCsv(options: StyledReportOptions): void {
  const base = options.filename.replace(/\.(xls|xlsx|csv|html)$/i, '');
  const csv = buildReportCsv(options);
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `${base}.csv`);
}

/** Download both .xls (styled) and .csv (reliable) exports. */
export function downloadStyledReportBundle(options: StyledReportOptions): void {
  downloadStyledReport(options);
  window.setTimeout(() => downloadReportCsv(options), 400);
}

/** Simple single-table helper — exports styled .xls + .csv. */
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
  downloadStyledReportBundle({
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
