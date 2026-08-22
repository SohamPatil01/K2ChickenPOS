# K2 Chicken POS — Reporting Architecture

## Overview

The BI & Reporting module extends the existing K2 Chicken POS monorepo with a unified **Business Reports** hub, shared backend reporting services, and minimal new database entities (Expense, Budget). All metrics are computed server-side from existing transactional data.

## Stack

| Layer | Technology | Location |
|-------|------------|----------|
| Store UI | Next.js App Router | `apps/web` |
| HQ UI | Next.js | `apps/hq-web` |
| API | Fastify + JWT RBAC | `apps/api/src` |
| Database | PostgreSQL + Prisma | `packages/db` |
| Shared utils | Date/payment helpers | `packages/shared` |

## Entity Map (reuse, no duplicates)

```
PurchaseOrder → InventoryLedger → Product
Sale → SaleItem, Payment, Customer
Customer → LoyaltyTransaction, referralCode, referredByCustomerId
User → Sale.createdBy, Shift, AuditLog
Shift → DailyClosing
Supplier → CentralPurchaseOrder (HQ)
ExpenseCategory → Expense (new)
Budget (new)
```

## API Layout

### New prefix: `/api/v1/reporting/*`

Registered in `apps/api/src/routes/reporting.ts`. Domain endpoints:

| Domain | Path prefix | RBAC |
|--------|-------------|------|
| Overview | `/reporting/overview` | OWNER, MANAGER |
| Inventory | `/reporting/inventory/*` | OWNER, MANAGER; CASHIER read stock/low-stock |
| Purchasing | `/reporting/purchasing/*` | OWNER, MANAGER |
| Financial | `/reporting/financial/*` | OWNER, MANAGER |
| Profitability | `/reporting/profitability/*` | OWNER, MANAGER |
| Customers | `/reporting/customers/*` | OWNER, MANAGER |
| Loyalty | `/reporting/loyalty/*` | OWNER, MANAGER |
| Referrals | `/reporting/referrals/*` | OWNER, MANAGER |
| Staff | `/reporting/staff/*` | OWNER, MANAGER; CASHIER own shift |
| Insights | `/reporting/insights` | OWNER, MANAGER |
| Expenses CRUD | `/reporting/expenses/*` | OWNER full; MANAGER create/read |
| Budgets CRUD | `/reporting/budgets/*` | OWNER full; MANAGER read |

### HQ rollup: `/api/v1/hq/reporting/*`

Same services with `storeIds[]` from franchise scope (`resolveFranchiseStoreIds`). OWNER only.

### Legacy wrappers

`/api/v1/reports/*` and `/api/v1/analytics/*` remain unchanged during migration. New BI endpoints do not duplicate legacy report logic.

## Store vs HQ Scope

- **Store:** Single `storeId` from JWT; OWNER may pass `storeId` query for franchise child.
- **HQ:** OWNER aggregates all franchise stores under parent owner store.
- Every query requires `storeId`/`storeIds` + date bounds.

## Frontend Layout

### Single entry: Business Reports

- Store: `/store/business-reports` (StoreShell)
- HQ: `/hq/business-reports` (HQLayout + store selector)

Catalog: `apps/web/src/lib/businessReportsCatalog.ts` — all existing + new reports with sections, roles, legacy paths.

Legacy redirects (Next.js):
- `/store/reports` → `/store/business-reports`
- `/reports` → `/store/business-reports`
- `/analytics` → `/store/business-reports?section=sales`
- `/store/analytics/*` → Business Reports sections

## RBAC Matrix

| Domain | OWNER | MANAGER | CASHIER |
|--------|-------|---------|---------|
| Financial / Budget / Expense CRUD | Full | Read + create expense | None |
| Profitability | Full | Full | None |
| Inventory | Full | Full | Read stock/low-stock |
| Purchasing | Full | Full | None |
| Customer / Loyalty / Referral | Full | Full | None |
| Staff performance | Full | Full | Own shift/sales |
| HQ multi-store rollup | Full | None | None |

## Performance Rules

- All list endpoints: pagination (default 50, max 500)
- Aggregates via Prisma `groupBy`, `_sum`, `$queryRaw` — never load-all in Node
- Date bounds required on every query
- Reports are online-only (no offline sync)

## Migration Strategy

1. Unified hub + catalog (Day 1 access to all 16 existing reports)
2. Legacy URL redirects preserve bookmarks
3. New BI endpoints added incrementally under `/api/v1/reporting/*`
4. `getProfitMarginTracker` updated to include real expenses when Expense table populated

## Known Risks & Limitations

- **COGS = weighted average from closed POs**, not FIFO
- **Supplier outstanding payments** — PO payment status not fully tracked; outstanding estimated from open POs
- **Referral rewards** span loyalty txn + customer fields
- **Cashier reconciliation** depends on Shift/DailyClosing discipline
- **HQ rollup** requires OWNER + franchise parent linkage

## Service Directory

```
apps/api/src/reporting/
├── shared/          dateRange, storeScope, pagination, exportCsv, metrics
├── inventory/
├── purchasing/
├── financial/
├── profitability/
├── customers/
├── loyalty/
├── referrals/
├── staff/
└── insights/
```
