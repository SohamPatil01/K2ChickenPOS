# K2 Chicken POS — Reporting Metrics

Canonical formulas for BI reports. Metrics marked **ledger-backed** come directly from database records. Metrics marked **estimated** use heuristics documented below.

## Sales Metrics

| Metric | Formula | Source |
|--------|---------|--------|
| Gross Sales | SUM(`Sale.grandTotal`) WHERE `status = PAID` | **ledger-backed** |
| Net Sales | Gross Sales − SUM(`Sale.grandTotal`) WHERE `status = REFUNDED` | **ledger-backed** |
| Discount Total | SUM(`Sale.discountTotal`) on PAID sales | **ledger-backed** |
| Tax Total | SUM(`Sale.taxTotal`) on PAID sales | **ledger-backed** |
| Order Count | COUNT PAID sales in range | **ledger-backed** |
| AOV | Net Sales / Order Count | derived |
| Revenue by Payment | SUM(`Payment.amount`) grouped by `method` | **ledger-backed** |

Business day: `Sale.businessDate` if set, else `createdAt` in Asia/Kolkata (IST).

## COGS & Profitability

| Metric | Formula | Source |
|--------|---------|--------|
| COGS (product) | `avgCost × qtySold` where avgCost = weighted avg from **closed PO line items** | **estimated** |
| Weighted Avg Cost | SUM(rate × qty) / SUM(qty) from PO items on CLOSED/RECEIVED POs | **ledger-backed** from POs |
| Gross Profit | Product revenue − COGS | derived |
| Gross Margin % | (Gross Profit / Revenue) × 100 | derived |
| Net Profit (store) | Net Sales − PO purchases − Expenses | derived |
| Profit Margin % | (Net Profit / Net Sales) × 100 | derived |
| Contribution % | Product gross profit / total gross profit × 100 | derived |

**Note:** Products without PO history show `costStatus: unknown`. COGS is **not FIFO**.

## Inventory Metrics

| Metric | Formula | Source |
|--------|---------|--------|
| Current Stock (kg/pcs) | SUM(IN qty) − SUM(OUT qty) from `InventoryLedger` | **ledger-backed** |
| Stock Value | Current qty × weighted avg PO cost | **estimated** |
| Movement | Ledger rows in date range with reason, refId | **ledger-backed** |
| Wastage Qty | SUM(OUT qty) WHERE `reason = WASTAGE` | **ledger-backed** |
| Wastage % | Wastage qty / (Sales qty + Wastage qty) × 100 | derived |
| Low Stock | Products where current qty < reorder threshold | derived from ledger + config |
| Variance | Ledger expected closing vs `DailyClosing.closingStockJson` | **estimated** |
| Turnover | COGS / Average Inventory (only when both computable) | derived; hidden if missing cost |

## Purchasing Metrics

| Metric | Formula | Source |
|--------|---------|--------|
| Purchase Total | SUM(PO line rate × received qty) in range | **ledger-backed** |
| PO Count | COUNT POs by status | **ledger-backed** |
| Supplier Performance | On-time delivery %, avg lead time from PO→GRN | **estimated** |
| Price Trend | Time series of PO line rates per product | **ledger-backed** |
| Outstanding Payments | SUM open PO value WHERE status ∉ CLOSED/REJECTED | **estimated** — payment tracking incomplete |

## Financial Metrics

| Metric | Formula | Source |
|--------|---------|--------|
| Revenue Summary | Payment tally on PAID sales (cash/card/UPI/credit) | **ledger-backed** |
| Total Expenses | SUM(`Expense.amount`) in range | **ledger-backed** (new model) |
| Budget vs Actual | Budget amount − actual (expenses + mapped PO spend) | derived |
| Budget Variance % | ((Actual − Budget) / Budget) × 100 | derived |
| Cash Flow | DailyClosing cash in/out + Shift opening/closing | **ledger-backed** |

## Customer Metrics

| Metric | Formula | Source |
|--------|---------|--------|
| Customer Count | COUNT distinct customers with ≥1 PAID sale | **ledger-backed** |
| LTV | SUM(`Sale.grandTotal`) per customer (lifetime PAID) | **ledger-backed** |
| Retention | Customers with sale in current period who also bought in prior period | derived |
| Purchase Frequency | Order count / active customers in range | derived |
| At-Risk | No purchase in N days (configurable, default 30) | derived |

## Loyalty Metrics

| Metric | Formula | Source |
|--------|---------|--------|
| Points Earned | SUM(`LoyaltyTransaction.points`) WHERE type = EARN | **ledger-backed** |
| Points Redeemed | ABS(SUM points) WHERE type = REDEEM | **ledger-backed** |
| Active Members | Customers with loyalty txn in range | **ledger-backed** |
| Redemption Rate | Redeemed / Earned × 100 | derived |

**Never recompute points from sales** — always use `LoyaltyTransaction`.

## Referral Metrics

| Metric | Formula | Source |
|--------|---------|--------|
| Referrals Count | COUNT customers WHERE `referredByCustomerId IS NOT NULL` | **ledger-backed** |
| Referral Revenue | SUM referred customers' PAID sale totals | **ledger-backed** |
| Conversion Rate | Referred with ≥1 PAID sale / total referred × 100 | derived |
| Top Referrers | GROUP BY referrer customer, COUNT + revenue | **ledger-backed** |

## Staff Metrics

| Metric | Formula | Source |
|--------|---------|--------|
| Sales by Employee | SUM(`Sale.grandTotal`) GROUP BY `createdByUserId` | **ledger-backed** |
| Discounts Given | SUM(`Sale.discountTotal`) + `DiscountOverride` | **ledger-backed** |
| Refunds/Voids | COUNT/SUM WHERE `status IN (VOID, REFUNDED)` | **ledger-backed** |
| Shift Reconciliation | Shift opening/closing cash vs payment tally | **ledger-backed** |
| Staff Activity | AuditLog entries by userId in range | **ledger-backed** |

## Insights Rules

Each insight returns: `{ metric, value, previousValue, deltaPct, reportPath }`

- Revenue delta vs prior period
- Wastage spike (>20% vs prior period)
- Stockout risk (qty = 0, sales in last 7 days)
- At-risk customers (no purchase 30+ days)
- Referral revenue growth

Only emitted when underlying metric exists.
