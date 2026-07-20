# K2 Chicken Loyalty Portal

Customer-facing loyalty page (not the POS app).

- **Local:** `pnpm --filter @azela-pos/loyalty-web dev` → http://localhost:3004  
- **Production domain:** `loyalty.k2chicken.com` (CNAME to this Vercel project)  
- **API:** uses `NEXT_PUBLIC_API_URL` (or Next rewrites to local API in development)

## Deploy (Vercel Free)

1. Create a Vercel project rooted at `apps/loyalty-web` (or monorepo with filter).
2. Set `NEXT_PUBLIC_API_URL` to your production API URL.
3. Add custom domain `loyalty.k2chicken.com` and DNS CNAME at the registrar that manages k2chicken.com.
4. Ensure the API CORS allowlist includes `https://loyalty.k2chicken.com` (already added in `apps/api/api/index.ts`).

## Behaviour

- Register / log in with phone + PIN (no SMS).
- Existing POS customers set a PIN on first register/login flow and see real points.
- New numbers get **0 points** until they shop with that number.
- Redeem only in the physical shop — the UI says so and links to [www.k2chicken.com](https://www.k2chicken.com).
- Languages: English / Hindi / Marathi.
