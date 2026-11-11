#!/usr/bin/env node
/**
 * Production smoke for /api/v1/mobile.
 * Read-only + quote/auth negative paths by default.
 * Set MOBILE_SMOKE_PHONE + MOBILE_SMOKE_PIN to exercise authenticated flows.
 * Set MOBILE_SMOKE_PLACE_ORDER=1 to place a real MOBILE_APP PreOrder (creates data).
 */
import { readFileSync } from 'node:fs';

const API = process.env.MOBILE_API_BASE || 'https://k2-chicken-pos-api.vercel.app/api/v1/mobile';
const POS = process.env.POS_API_BASE || 'https://k2-chicken-pos-api.vercel.app';
const results = [];

function ok(name, detail = '') {
  results.push({ name, pass: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail = '') {
  results.push({ name, pass: false, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function req(method, path, { body, token, headers = {}, base = API } = {}) {
  const h = { Accept: 'application/json', ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  const r = await fetch(base + path, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 200) }; }
  return { status: r.status, json, headers: r.headers };
}

function assert(name, cond, detail) {
  if (cond) ok(name, detail);
  else fail(name, detail);
}

async function main() {
  const pick = JSON.parse(readFileSync('/tmp/mobile_smoke_pick.json', 'utf8'));
  const storeId = pick.storeId;
  const product = pick.product;

  // --- POS still up ---
  {
    const r = await req('GET', '/health', { base: POS });
    assert('POS /health', r.status === 200 && r.json?.status === 'ok', `HTTP ${r.status}`);
  }

  // --- Public ---
  {
    const r = await req('GET', '/config');
    assert('GET /config', r.status === 200 && r.json?.apiVersion === 1, `otp=${r.json?.auth?.otpAvailable} pin=${r.json?.auth?.portalPinLogin}`);
  }
  {
    const r = await req('GET', '/stores');
    assert('GET /stores', r.status === 200 && Array.isArray(r.json?.stores) && r.json.stores.length > 0, `${r.json?.stores?.length} stores`);
  }
  {
    const r = await req('GET', `/stores/${storeId}/catalog`);
    assert(
      'GET /catalog',
      r.status === 200 && (r.json?.products?.length ?? 0) > 0,
      `${r.json?.products?.length ?? 0} products, ${r.json?.categories?.length ?? 0} categories`
    );
  }
  {
    const r = await req('GET', `/stores/${storeId}/products/${product.id}`);
    assert(
      'GET /product',
      r.status === 200 && r.json?.product?.id === product.id,
      r.json?.product?.name || `HTTP ${r.status}`
    );
  }
  {
    const r = await req('GET', `/stores/${storeId}/products/does-not-exist-xyz`);
    assert('GET /product 404', r.status === 404 || r.json?.code === 'NOT_FOUND' || r.json?.code === 'PRODUCT_NOT_FOUND', `HTTP ${r.status} ${r.json?.code || ''}`);
  }

  // --- Quote (guest) ---
  const line =
    product.unitType === 'KG'
      ? { productId: product.id, grams: 500 }
      : { productId: product.id, pieces: 1 };
  let quote;
  {
    const r = await req('POST', '/checkout/quotes', { body: { storeId, lines: [line] } });
    quote = r.json?.quote ?? r.json;
    const total = quote?.totalPaise ?? quote?.payablePaise ?? quote?.grandTotalPaise ?? quote?.merchandisePaise;
    assert(
      'POST /checkout/quotes guest',
      r.status === 200 && typeof total === 'number' && total > 0 && quote?.lines?.[0]?.orderable === true,
      `totalPaise=${total} lineStatus=${quote?.lines?.[0]?.status || 'n/a'}`
    );
  }
  {
    const r = await req('POST', '/checkout/quotes', { body: { storeId, lines: [{ productId: product.id, grams: 1 }] } });
    const q = r.json?.quote ?? r.json;
    assert(
      'POST /checkout/quotes marks bad weight unorderable',
      r.status === 200 && q?.lines?.[0]?.orderable === false,
      `status=${q?.lines?.[0]?.status} HTTP ${r.status}`
    );
  }

  // --- Analytics ---
  {
    const r = await req('POST', '/analytics/events', {
      body: {
        anonymousId: 'smoke-test-' + Date.now(),
        platform: 'ios',
        appVersion: '1.0.0',
        events: [{ name: 'app_opened', occurredAt: new Date().toISOString(), properties: { source: 'smoke' } }],
      },
    });
    assert('POST /analytics/events', r.status === 200 && (r.json?.accepted ?? 0) >= 1, JSON.stringify(r.json));
  }

  // --- Auth negative / expected ---
  {
    const r = await req('POST', '/auth/otp/request', { body: { phone: '9876543210' } });
    assert(
      'POST /auth/otp/request (expect 503 until provider set)',
      r.status === 503 && r.json?.code === 'OTP_PROVIDER_NOT_CONFIGURED',
      `HTTP ${r.status} ${r.json?.code || ''}`
    );
  }
  {
    const r = await req('POST', '/auth/pin/login', { body: { phone: '9876543210', pin: '0000' } });
    assert('POST /auth/pin/login wrong creds → 401', r.status === 401, `HTTP ${r.status} ${r.json?.code || ''}`);
  }
  {
    const r = await req('GET', '/me');
    assert('GET /me without token → 401', r.status === 401, `HTTP ${r.status}`);
  }
  {
    const r = await req('GET', '/admin/sync-health');
    assert('GET /admin/sync-health without staff JWT → 401', r.status === 401 || r.status === 403, `HTTP ${r.status}`);
  }

  // --- Auth positive (optional) ---
  const phone = process.env.MOBILE_SMOKE_PHONE;
  const pin = process.env.MOBILE_SMOKE_PIN;
  let accessToken;
  if (phone && pin) {
    const r = await req('POST', '/auth/pin/login', { body: { phone, pin, platform: 'ios', appVersion: '1.0.0' } });
    accessToken = r.json?.accessToken;
    assert('POST /auth/pin/login real customer', r.status === 200 && !!accessToken, `HTTP ${r.status} ${r.json?.code || ''}`);
    if (accessToken) {
      const me = await req('GET', '/me', { token: accessToken });
      assert('GET /me', me.status === 200 && me.json?.phone, `phone=${me.json?.phone}`);
      const home = await req('GET', `/me/home?storeId=${encodeURIComponent(storeId)}`, { token: accessToken });
      assert('GET /me/home', home.status === 200, `HTTP ${home.status} openOrders=${home.json?.openOrders?.length ?? '?'}`);
      const loy = await req('GET', '/me/loyalty', { token: accessToken });
      assert('GET /me/loyalty', loy.status === 200 && typeof loy.json?.availablePoints === 'number', `pts=${loy.json?.availablePoints}`);
      const orders = await req('GET', '/me/orders', { token: accessToken });
      assert('GET /me/orders', orders.status === 200 && Array.isArray(orders.json?.orders || orders.json), `HTTP ${orders.status}`);

      // Re-quote after login so we have slots + canCheckout
      const q2 = await req('POST', '/checkout/quotes', { token: accessToken, body: { storeId, lines: [line], fulfillment: 'PICKUP' } });
      const q = q2.json?.quote ?? q2.json;
      const slots = q2.json?.slots || [];
      const slotStart = slots[0]?.start || slots[0]?.slotStart || q?.slotStart;
      const confirmedTotalPaise = q?.totalPaise;
      assert('POST /checkout/quotes authenticated', q2.status === 200 && q?.canCheckout === true, `canCheckout=${q?.canCheckout} slots=${slots.length}`);
      if (process.env.MOBILE_SMOKE_PLACE_ORDER === '1' && confirmedTotalPaise && slotStart) {
        const key = 'smoke-' + Date.now();
        const body = {
          storeId,
          lines: [line],
          fulfillment: 'PICKUP',
          paymentMethod: 'PAY_AT_PICKUP',
          slotStart,
          confirmedTotalPaise,
        };
        const o1 = await req('POST', '/orders', { token: accessToken, body, headers: { 'idempotency-key': key } });
        const orderId = o1.json?.order?.id || o1.json?.id || o1.json?.preOrderId;
        assert('POST /orders create', (o1.status === 200 || o1.status === 201) && !!orderId, `HTTP ${o1.status} ${o1.json?.code || orderId || JSON.stringify(o1.json).slice(0, 120)}`);
        const o2 = await req('POST', '/orders', { token: accessToken, body, headers: { 'idempotency-key': key } });
        const orderId2 = o2.json?.order?.id || o2.json?.id || o2.json?.preOrderId;
        assert('POST /orders idempotent replay', (o2.status === 200 || o2.status === 201) && orderId && orderId === orderId2, `id1=${orderId} id2=${orderId2}`);
        const detail = await req('GET', `/me/orders/${orderId}`, { token: accessToken });
        assert('GET /me/orders/:id', detail.status === 200, `HTTP ${detail.status}`);
      } else {
        ok('POST /orders skipped', 'set MOBILE_SMOKE_PLACE_ORDER=1 with PIN to place a real PreOrder');
      }

      const refresh = r.json?.refreshToken;
      if (refresh) {
        const rr = await req('POST', '/auth/refresh', { body: { refreshToken: refresh } });
        assert('POST /auth/refresh', rr.status === 200 && !!rr.json?.accessToken, `HTTP ${rr.status}`);
      }
      const lo = await req('POST', '/auth/logout', { token: accessToken });
      assert('POST /auth/logout', lo.status === 200, `HTTP ${lo.status}`);
    }
  } else {
    ok('auth positive skipped', 'set MOBILE_SMOKE_PHONE + MOBILE_SMOKE_PIN to verify login/me/orders');
  }

  const failed = results.filter((x) => !x.pass);
  console.log('\n--- summary ---');
  console.log(`${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAIL: ${f.name} — ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
