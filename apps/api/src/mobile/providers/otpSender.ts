/**
 * OTP delivery. The POS has NO SMS integration today (only staff passwords and portal PINs),
 * so production OTP is blocked until an Indian DLT-registered SMS/WhatsApp-auth provider is
 * chosen and credentials are supplied (see docs). The dev sender exists only for local/staging.
 */
export interface OtpSender {
  readonly name: string;
  readonly configured: boolean;
  send(args: { phoneE164: string; code: string; ttlSeconds: number }): Promise<{ ok: boolean; error?: string }>;
}

class DevConsoleOtpSender implements OtpSender {
  readonly name = 'dev-console';
  readonly configured = true;
  async send(args: { phoneE164: string; code: string }) {
    // Dev only: never enabled when NODE_ENV=production (see resolveOtpSender).
    console.info(`[mobile-otp:dev] OTP for ${args.phoneE164.slice(0, 5)}•••••${args.phoneE164.slice(-2)}: ${args.code}`);
    return { ok: true };
  }
}

class NotConfiguredOtpSender implements OtpSender {
  readonly name = 'not-configured';
  readonly configured = false;
  async send() {
    return { ok: false, error: 'OTP_PROVIDER_NOT_CONFIGURED' };
  }
}

let override: OtpSender | null = null;
export function setOtpSenderForTests(s: OtpSender | null) {
  override = s;
}

export function resolveOtpSender(): OtpSender {
  if (override) return override;
  const p = process.env.MOBILE_OTP_PROVIDER || '';
  if (p === 'dev-console' && process.env.NODE_ENV !== 'production') return new DevConsoleOtpSender();
  return new NotConfiguredOtpSender();
}

/** Return the code in the API response — only for automated tests / local dev, never production. */
export function otpEchoEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.MOBILE_OTP_DEV_ECHO === 'true';
}
