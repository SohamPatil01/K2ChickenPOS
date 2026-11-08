/**
 * Expo Push Service adapter (https://docs.expo.dev/push-notifications/sending-notifications/).
 * Uses the HTTPS API directly so no new dependency is added to the POS API.
 * Requires the app's FCM (Android) and APNs (iOS) credentials to be uploaded to EAS.
 */
export type PushMessage = {
  token: string;
  title: string;
  body: string;
  data: Record<string, string>;
  channelId?: string;
};

export type PushResult =
  | { token: string; status: 'ok'; ticketId?: string }
  | { token: string; status: 'error'; error: string; invalidToken: boolean };

export interface PushProvider {
  readonly name: string;
  send(messages: PushMessage[]): Promise<PushResult[]>;
}

export function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[\w-]+\]$/.test(token);
}

export class ExpoPushProvider implements PushProvider {
  readonly name = 'expo';
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async send(messages: PushMessage[]): Promise<PushResult[]> {
    const results: PushResult[] = [];
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
      if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
      try {
        const res = await this.fetchImpl('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers,
          body: JSON.stringify(
            chunk.map((m) => ({
              to: m.token,
              title: m.title,
              body: m.body,
              data: m.data,
              sound: 'default',
              channelId: m.channelId ?? 'default',
            }))
          ),
        });
        if (!res.ok) {
          for (const m of chunk) results.push({ token: m.token, status: 'error', error: `HTTP_${res.status}`, invalidToken: false });
          continue;
        }
        const json = (await res.json()) as { data?: Array<{ status: string; id?: string; message?: string; details?: { error?: string } }> };
        chunk.forEach((m, idx) => {
          const t = json.data?.[idx];
          if (t?.status === 'ok') results.push({ token: m.token, status: 'ok', ticketId: t.id });
          else {
            const err = t?.details?.error || t?.message || 'UNKNOWN';
            results.push({ token: m.token, status: 'error', error: err, invalidToken: err === 'DeviceNotRegistered' });
          }
        });
      } catch (e) {
        for (const m of chunk) {
          results.push({ token: m.token, status: 'error', error: (e as Error).message || 'NETWORK', invalidToken: false });
        }
      }
    }
    return results;
  }
}

let override: PushProvider | null = null;
export function setPushProviderForTests(p: PushProvider | null) {
  override = p;
}
export function resolvePushProvider(): PushProvider {
  return override ?? new ExpoPushProvider();
}
