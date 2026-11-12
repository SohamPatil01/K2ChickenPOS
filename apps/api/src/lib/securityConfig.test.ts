import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  isAllowedCorsOrigin,
  requireBackupAuth,
  resolveJwtSecret,
  shouldSkipGlobalRateLimit,
} from './securityConfig.js';

describe('securityConfig', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it('rejects unknown CORS origins in production-like allowlist', () => {
    expect(isAllowedCorsOrigin('https://evil.example.com')).toBe(false);
    expect(isAllowedCorsOrigin('https://k2chicken.com')).toBe(true);
    expect(isAllowedCorsOrigin('https://pos.azeelaai.com')).toBe(true);
    expect(isAllowedCorsOrigin(null)).toBe(true);
  });

  it('fails closed when BACKUP_SECRET is missing', () => {
    delete process.env.BACKUP_SECRET;
    const result = requireBackupAuth({ headers: {} });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ ok: false, status: 503 });
  });

  it('accepts x-backup-secret header and rejects query-only secrets', () => {
    process.env.BACKUP_SECRET = 'test-backup-secret-value';
    expect(
      requireBackupAuth({ headers: { 'x-backup-secret': 'test-backup-secret-value' } }).ok
    ).toBe(true);
    expect(requireBackupAuth({ headers: {} }).ok).toBe(false);
    expect(
      requireBackupAuth({ headers: { 'x-vercel-cron': '1' } }).ok
    ).toBe(true);
  });

  it('requires strong JWT secret in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.VERCEL_ENV;
    delete process.env.JWT_SECRET;
    expect(() => resolveJwtSecret()).toThrow(/JWT_SECRET/);
  });

  it('does not skip auth routes from global rate limit', () => {
    expect(shouldSkipGlobalRateLimit('/api/v1/auth/login', 'POST')).toBe(false);
    expect(shouldSkipGlobalRateLimit('/health', 'GET')).toBe(true);
    expect(shouldSkipGlobalRateLimit('/api/v1/sales', 'OPTIONS')).toBe(true);
  });
});
