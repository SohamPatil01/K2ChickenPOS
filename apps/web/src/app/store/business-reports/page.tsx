'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  Star,
  ChevronRight,
  BarChart3,
  TrendingUp,
  Package,
  Users,
  Wallet,
  ClipboardList,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import {
  BUSINESS_REPORT_CATALOG,
  REPORT_SECTIONS,
  getReportsForRole,
  searchReports,
  type ReportSection,
} from '@/lib/businessReportsCatalog';

const RECENTS_KEY = 'k2_business_reports_recents';
const FAVORITES_KEY = 'k2_business_reports_favorites';

const SECTION_ICONS: Record<ReportSection, React.ReactNode> = {
  overview: <BarChart3 className="h-4 w-4" />,
  sales: <TrendingUp className="h-4 w-4" />,
  financial: <Wallet className="h-4 w-4" />,
  profitability: <TrendingUp className="h-4 w-4" />,
  inventory: <Package className="h-4 w-4" />,
  purchasing: <ClipboardList className="h-4 w-4" />,
  customers: <Users className="h-4 w-4" />,
  loyalty: <Star className="h-4 w-4" />,
  staff: <Users className="h-4 w-4" />,
};

function loadJson(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

function saveJson(key: string, val: string[]) {
  localStorage.setItem(key, JSON.stringify(val.slice(0, 10)));
}

export default function BusinessReportsHubPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [section, setSection] = useState<ReportSection | 'all'>(
    (searchParams.get('section') as ReportSection) || 'all'
  );
  const [overview, setOverview] = useState<any>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    setFavorites(loadJson(FAVORITES_KEY));
    setRecents(loadJson(RECENTS_KEY));
  }, []);

  useEffect(() => {
    if (!user || (user.role !== 'OWNER' && user.role !== 'MANAGER' && user.role !== 'CASHIER')) {
      router.push('/store');
    }
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    api
      .get('/api/v1/reporting/overview?preset=last30')
      .then((r) => setOverview(r.data))
      .catch(() => setOverview(null));
  }, [user]);

  const visibleReports = useMemo(() => {
    if (!user) return [];
    let list = search ? searchReports(search, user.role) : getReportsForRole(user.role);
    if (section !== 'all') list = list.filter((r) => r.section === section);
    return list;
  }, [user, search, section]);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveJson(FAVORITES_KEY, next);
      return next;
    });
  };

  const openReport = (id: string, path: string) => {
    const next = [id, ...recents.filter((x) => x !== id)];
    setRecents(next);
    saveJson(RECENTS_KEY, next);
    router.push(path);
  };

  if (!user) return null;

  const favReports = BUSINESS_REPORT_CATALOG.filter(
    (r) => favorites.includes(r.id) && r.roles.includes(user.role)
  );
  const recentReports = recents
    .map((id) => BUSINESS_REPORT_CATALOG.find((r) => r.id === id))
    .filter(Boolean)
    .filter((r) => r!.roles.includes(user.role)) as typeof BUSINESS_REPORT_CATALOG;

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-ink">Business Reports</h1>
        <p className="text-sm text-ink-secondary mt-1">
          All sales, financial, inventory, and analytics reports in one place
        </p>
      </div>

      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Net Sales (30d)', value: `₹${overview.netSales?.toLocaleString('en-IN') ?? '—'}` },
            { label: 'Orders', value: overview.orderCount ?? '—' },
            { label: 'Net Profit', value: `₹${overview.netProfit?.toLocaleString('en-IN') ?? '—'}` },
            { label: 'AOV', value: `₹${overview.aov?.toLocaleString('en-IN') ?? '—'}` },
          ].map((kpi) => (
            <div key={kpi.label} className="glass-panel rounded-xl p-4">
              <p className="text-xs text-ink-muted">{kpi.label}</p>
              <p className="text-lg font-semibold text-ink mt-1">{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        <aside className="lg:w-52 shrink-0">
          <div className="glass-panel rounded-xl p-3 space-y-1">
            <button
              onClick={() => setSection('all')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                section === 'all' ? 'bg-brand-500/15 text-brand-600 font-medium' : 'text-ink-secondary hover:bg-surface-2'
              }`}
            >
              All Reports
            </button>
            {REPORT_SECTIONS.map((s) => {
              const count = getReportsForRole(user.role, s.id).length;
              if (count === 0) return null;
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                    section === s.id ? 'bg-brand-500/15 text-brand-600 font-medium' : 'text-ink-secondary hover:bg-surface-2'
                  }`}
                >
                  {SECTION_ICONS[s.id]}
                  <span className="flex-1 truncate">{s.label}</span>
                  <span className="text-xs text-ink-muted">{count}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="flex-1 min-w-0 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
            <input
              type="search"
              placeholder="Search reports..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-surface text-ink text-sm"
            />
          </div>

          {favReports.length > 0 && !search && section === 'all' && (
            <section>
              <h2 className="text-sm font-semibold text-ink-secondary mb-2 flex items-center gap-1">
                <Star className="h-4 w-4" /> Favorites
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {favReports.map((r) => (
                  <ReportCard
                    key={r.id}
                    report={r}
                    isFavorite
                    onOpen={() => openReport(r.id, r.path)}
                    onToggleFavorite={() => toggleFavorite(r.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {recentReports.length > 0 && !search && section === 'all' && (
            <section>
              <h2 className="text-sm font-semibold text-ink-secondary mb-2">Recently viewed</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {recentReports.slice(0, 4).map((r) => (
                  <ReportCard
                    key={r.id}
                    report={r}
                    isFavorite={favorites.includes(r.id)}
                    onOpen={() => openReport(r.id, r.path)}
                    onToggleFavorite={() => toggleFavorite(r.id)}
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold text-ink-secondary mb-2">
              {section === 'all' ? 'All reports' : REPORT_SECTIONS.find((s) => s.id === section)?.label}
              <span className="text-ink-muted font-normal ml-2">({visibleReports.length})</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {visibleReports.map((r) => (
                <ReportCard
                  key={r.id}
                  report={r}
                  isFavorite={favorites.includes(r.id)}
                  onOpen={() => openReport(r.id, r.path)}
                  onToggleFavorite={() => toggleFavorite(r.id)}
                />
              ))}
            </div>
            {visibleReports.length === 0 && (
              <p className="text-sm text-ink-muted py-8 text-center">No reports match your search.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ReportCard({
  report,
  isFavorite,
  onOpen,
  onToggleFavorite,
}: {
  report: (typeof BUSINESS_REPORT_CATALOG)[0];
  isFavorite: boolean;
  onOpen: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <div className="glass-panel rounded-xl p-4 flex items-start gap-3 group">
      <button onClick={onOpen} className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-ink text-sm truncate">{report.label}</p>
          {report.status === 'new' && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand-500/15 text-brand-600">
              New
            </span>
          )}
        </div>
        <p className="text-xs text-ink-muted mt-0.5 line-clamp-2">{report.description}</p>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className="p-1 text-ink-muted hover:text-brand-500"
        aria-label={isFavorite ? 'Remove favorite' : 'Add favorite'}
      >
        <Star className={`h-4 w-4 ${isFavorite ? 'fill-brand-500 text-brand-500' : ''}`} />
      </button>
      <button onClick={onOpen} className="p-1 text-ink-muted group-hover:text-ink">
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
