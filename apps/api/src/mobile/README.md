# K2 Chicken customer app API (`/api/v1/mobile`)

Additive Fastify module for the native K2 Chicken app. It **reads** POS tables
(products, prices, stock ledger, sales, pre-orders, loyalty) and **writes only**:

* `PreOrder` rows (source `MOBILE_APP`) — the existing online-order path staff already use in
  **Store → Pre-orders**, then bill with "load into cart" as today;
* its own tables (identity, sessions, devices, consents, plans, outbox, …).

It never writes inventory, prices, sales or payments. Loyalty earning stays in `lib/loyalty.ts`.

| Area | Endpoints |
| --- | --- |
| Public | `GET /config`, `GET /stores`, `GET /stores/:id/catalog`, `GET /stores/:id/products/:pid`, `POST /checkout/quotes`, `POST /analytics/events` |
| Auth | `POST /auth/otp/request`, `/auth/otp/verify`, `/auth/pin/login`, `/auth/refresh`, `/auth/logout` |
| Customer | `GET/PATCH /me`, `/me/home`, `/me/addresses*`, `POST /orders` (Idempotency-Key), `/me/orders*` (+ `/cancel`, `/reorder-quote`), `/me/loyalty`, `/me/referrals*`, `/me/consents`, `/me/notification-preferences`, `/me/notifications`, `/me/push-devices*`, `/me/weekly-plans*`, `/me/data-export`, `/me/deletion-request` |
| Staff (OWNER/MANAGER JWT) | `GET /admin/retention`, `GET /admin/sync-health`, `GET/PUT /admin/store-config/:storeId` |
| Scheduler | `GET/POST /cron/tick` with `Authorization: Bearer $MOBILE_CRON_SECRET` (or `CRON_SECRET`) |

## Environment

| Variable | Default | Notes |
| --- | --- | --- |
| `MOBILE_OTP_PROVIDER` | _(unset → OTP disabled, 503)_ | `dev-console` only works when `NODE_ENV !== production` |
| `MOBILE_OTP_DEV_ECHO` | `false` | returns `devCode` (non-production only, for tests) |
| `MOBILE_OTP_SECRET` | `JWT_SECRET` | HMAC key for OTP hashes |
| `MOBILE_ALLOW_PORTAL_PIN_LOGIN` | `true` | existing points-portal PIN holders can sign in |
| `MOBILE_CRON_SECRET` | – | required for `/cron/tick` |
| `EXPO_ACCESS_TOKEN` | – | optional Expo push security token |
| `MOBILE_PUBLIC_ASSET_BASE_URL` | – | resolves relative `Product.imageUrl` (`/book/products/…`) |
| `MOBILE_REDEEM_MAX_PERCENT` / `MOBILE_REDEEM_MIN_POINTS` | 5 / 50 | app redemption limits (pilot) |
| `MOBILE_REFERRAL_MONTHLY_CAP` | 10 | referrals a code can attribute per 30 days |
| `MOBILE_MILESTONE_EVERY_ORDERS` / `MOBILE_MILESTONE_BONUS_POINTS` | 0 / 0 | milestone bonus (disabled) |
| `MOBILE_REORDER_HOLDOUT_PERCENT` | 10 | stable holdout for reorder reminders |
| `MOBILE_SUPPORT_PHONE`, `MOBILE_SUPPORT_EMAIL`, `MOBILE_PRIVACY_URL`, `MOBILE_TERMS_URL`, `MOBILE_REFERRAL_LINK_BASE`, `MOBILE_MIN_APP_VERSION` | – | shown in the app |

## Tests

```bash
pnpm --filter @azela-pos/api test                       # unit (integration skipped)
MOBILE_IT_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/azela_pos_test \
  pnpm --filter @azela-pos/api test                     # + real-Postgres end-to-end suite (wipes that DB)
npx tsc -p apps/api/tsconfig.mobile.json                # strict typecheck of this module
```

Full design notes live in the mobile repo: `docs/architecture/`.
