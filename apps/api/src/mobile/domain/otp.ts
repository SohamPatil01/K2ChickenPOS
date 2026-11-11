import { createHmac, randomInt, timingSafeEqual, createHash, randomBytes } from 'node:crypto';

export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 300;
export const OTP_RESEND_COOLDOWN_SECONDS = 30;
export const OTP_MAX_PER_HOUR = 5;
export const OTP_MAX_ATTEMPTS = 5;

function secret(): string {
  const s = process.env.MOBILE_OTP_SECRET || process.env.JWT_SECRET;
  if (!s) throw new Error('MOBILE_OTP_SECRET (or JWT_SECRET) must be set');
  return s;
}

export function generateOtp(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
}

export function hashOtp(phone: string, code: string, challengeId: string): string {
  return createHmac('sha256', secret()).update(`${challengeId}:${phone}:${code}`).digest('hex');
}

export function otpMatches(expectedHash: string, phone: string, code: string, challengeId: string): boolean {
  const a = Buffer.from(expectedHash, 'hex');
  const b = Buffer.from(hashOtp(phone, code, challengeId), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Non-reversible IP fingerprint for abuse analysis without storing raw IPs. */
export function hashIp(ip: string | undefined): string | null {
  if (!ip) return null;
  return createHmac('sha256', secret()).update(`ip:${ip}`).digest('hex').slice(0, 32);
}

export function newRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
