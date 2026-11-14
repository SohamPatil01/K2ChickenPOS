# K2 Chicken POS

Production POS for chicken butcher stores — fast billing, franchise operations, loyalty, and delivery in one system.

Built and shipped for real store use: offline-capable checkout, weighing-scale barcodes, multi-store HQ, and a customer loyalty portal.

---

## What it does

| Area | Highlights |
|------|------------|
| **POS billing** | Barcode + scale support, UPI/cash/credit, store credit, pending dues |
| **Loyalty** | Earn 1.25% of settled bills, redeem 1 pt = ₹1, referrals, customer portal |
| **Customers** | Profiles, purchase history, areas, WhatsApp bills |
| **Inventory** | Stock, wastage, yield tracking, HQ thresholds |
| **Franchise** | Purchase orders → dispatch → GRN across owner / franchise stores |
| **Delivery** | Driver assign, OTP handoff, live status |
| **HQ & analytics** | Multi-store dashboards, sales trends, payment mix, store compare |
| **Offline** | IndexedDB queue; sync when the network returns |

---

## Monorepo

```
apps/
  api/           Fastify + Prisma API (Vercel)
  web/           Store POS (Next.js)
  hq-web/        Franchise / owner HQ
  loyalty-web/   Customer loyalty portal
packages/
  db/            Prisma schema & client
  shared/        Zod schemas & shared helpers
  offline/       Dexie offline sync
```

**Stack:** Next.js · TypeScript · Fastify · Prisma · PostgreSQL · Tailwind · Zustand · Dexie

---

## Quick start (local)

**Needs:** Node 20+, pnpm 8+, PostgreSQL

```bash
pnpm install
cp .env.example .env   # set DATABASE_URL, JWT secrets, etc.
pnpm db:generate
pnpm db:migrate
pnpm db:seed           # optional demo data
pnpm dev
```

| App | URL |
|-----|-----|
| POS | http://localhost:3000 |
| API | http://localhost:3001 |
| HQ  | http://localhost:3002 |

Seeded login phones/passwords live in your local seed script only — never commit real credentials.

---

## Common commands

```bash
pnpm dev              # API + web (and related apps)
pnpm build
pnpm type-check
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```

---

## Loyalty (brief)

- **Earn:** `floor(grandTotal × 1.25%)` on first real settlement of a paid sale  
- **Redeem:** 1 point = ₹1 at checkout  
- **Referral:** bonus on a friend’s first settled bill  
- Customer-facing UI: `apps/loyalty-web`

---

## Deploy

API and web apps target **Vercel**. Set production env vars from `.env.example`, run migrations (`pnpm db:migrate:deploy`), then deploy each app.

---

## License

Proprietary — all rights reserved.  
Built by [Soham Patil](https://github.com/SohamPatil01).
