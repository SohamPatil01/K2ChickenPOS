/**
 * Indian mobile number handling.
 * POS stores customer phones as bare digits (usually 10, sometimes with a 91 prefix),
 * so we normalise to the 10-digit national number for matching and to E.164 for display/SMS.
 */
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

export function normalizeIndianMobile(raw: unknown): string | null {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return INDIAN_MOBILE.test(digits) ? digits : null;
}

export function toE164India(national10: string): string {
  return `+91${national10}`;
}

/** Phone variants as they may appear in legacy POS rows. */
export function posPhoneVariants(national10: string): string[] {
  return [national10, `91${national10}`, `+91${national10}`, `0${national10}`];
}

export function maskPhone(national10: string): string {
  return `••••••${national10.slice(-4)}`;
}
