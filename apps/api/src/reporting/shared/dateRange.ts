// @ts-nocheck
import {
  parseStoreDateRange,
  resolveStoreDateRange,
  ymdInStoreTz,
  ymdDaysAgoInStoreTz,
} from '@azela-pos/shared';

export type DatePreset =
  | 'today'
  | 'last7'
  | 'last30'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisQuarter'
  | 'thisYear';

export function resolveReportingDateRange(
  startDate?: string,
  endDate?: string,
  preset?: DatePreset,
  defaultDaysBack = 29
): { gte: Date; lte: Date; startYmd: string; endYmd: string } {
  if (preset) {
    const today = ymdInStoreTz();
    let startYmd: string;
    let endYmd = today;
    switch (preset) {
      case 'today':
        startYmd = today;
        break;
      case 'last7':
        startYmd = ymdDaysAgoInStoreTz(6);
        break;
      case 'last30':
        startYmd = ymdDaysAgoInStoreTz(29);
        break;
      case 'thisMonth': {
        const [y, m] = today.split('-').map(Number);
        startYmd = `${y}-${String(m).padStart(2, '0')}-01`;
        break;
      }
      case 'lastMonth': {
        const anchor = new Date(`${today}T12:00:00.000+05:30`);
        anchor.setMonth(anchor.getMonth() - 1);
        const y = anchor.getFullYear();
        const m = anchor.getMonth() + 1;
        startYmd = `${y}-${String(m).padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        endYmd = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        break;
      }
      case 'thisQuarter': {
        const [y, m] = today.split('-').map(Number);
        const qStart = Math.floor((m - 1) / 3) * 3 + 1;
        startYmd = `${y}-${String(qStart).padStart(2, '0')}-01`;
        break;
      }
      case 'thisYear':
        startYmd = `${today.slice(0, 4)}-01-01`;
        break;
      default:
        startYmd = ymdDaysAgoInStoreTz(defaultDaysBack);
    }
    const bounds = parseStoreDateRange(startYmd, endYmd)!;
    return { ...bounds, startYmd, endYmd };
  }

  const bounds =
    parseStoreDateRange(startDate, endDate) ||
    resolveStoreDateRange(startDate, endDate, defaultDaysBack);
  return {
    ...bounds,
    startYmd: startDate?.split('T')[0] || ymdInStoreTz(bounds.gte),
    endYmd: endDate?.split('T')[0] || ymdInStoreTz(bounds.lte),
  };
}

export function priorPeriodRange(
  gte: Date,
  lte: Date
): { gte: Date; lte: Date; startYmd: string; endYmd: string } {
  const startYmd = ymdInStoreTz(gte);
  const endYmd = ymdInStoreTz(lte);
  const startMs = gte.getTime();
  const endMs = lte.getTime();
  const spanMs = endMs - startMs + 1;
  const priorEnd = new Date(startMs - 1);
  const priorStart = new Date(priorEnd.getTime() - spanMs + 1);
  return {
    gte: priorStart,
    lte: priorEnd,
    startYmd: ymdInStoreTz(priorStart),
    endYmd: ymdInStoreTz(priorEnd),
  };
}
