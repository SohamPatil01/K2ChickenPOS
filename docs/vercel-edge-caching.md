# Vercel edge caching (reduce origin / function invocations)

Configuration follows [Vercel CDN caching](https://vercel.com/docs/cdn-cache) guidance (also available via **Vercel MCP** → `search_vercel_documentation` on topics like *Cache-Control*, *Vercel-CDN-Cache-Control*).

## Idea

- **`Cache-Control`**: what browsers and shared caches see (`max-age`, `s-maxage`, `stale-while-revalidate`).
- **`CDN-Cache-Control`**: downstream CDNs (when applicable).
- **`Vercel-CDN-Cache-Control`**: **Vercel’s edge only** — often **longer** than the browser TTL so repeat requests are served from the edge without hitting your **Node/serverless origin**, which cuts latency and compute.

Use **short** browser `max-age` for semi-dynamic JSON when you still want a **long** edge TTL.

## This repo

| Project        | File                 | What we did |
|----------------|----------------------|-------------|
| API (Fastify)  | `apps/api/vercel.json` | Multi-tier headers on safe GET paths: `/health`, `/api/v1/products/categories`, `/api/v1/auth/profiles`, `/api/v1/backup/health`. |
| Web (Next.js)  | `apps/web/vercel.json` | Strong caching for `/_next/static/*` and tuned caching for `/_next/image`. |

## Multi-tenant caution

Do **not** put long **`Vercel-CDN-Cache-Control`** on routes whose JSON **varies by user/store** unless the cache key differs (e.g. `Vary: Authorization` and you understand the implications). Routes cached here are either health checks or currently **global-per-deployment** in code (e.g. categories tied to first owner store). Tighten or remove edge TTLs if you move to true multi-tenant per-request data on the same URL.

## Optional next steps

- Return `Vercel-CDN-Cache-Control` from **route handlers** for fine-grained control.
- For **Next.js rewrites** to an external API, see Vercel docs on **rewrite caching** and `x-vercel-enable-rewrite-caching` if the upstream sets `Cache-Control`.
