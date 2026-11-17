/**
 * Webhook authentication.
 *
 * Layer 1 (mandatory): Telegram sends the `secret_token` we registered with
 * setWebhook in the `X-Telegram-Bot-Api-Secret-Token` header. Anyone who
 * doesn't know it can't forge updates. Compared in constant time.
 *
 * Layer 2 (default on): the request must come from Telegram's published
 * webhook IP ranges. See https://core.telegram.org/bots/webhooks
 */

export const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";

/** Telegram's documented webhook source ranges (IPv4). */
export const TELEGRAM_CIDRS: ReadonlyArray<readonly [string, number]> = [
  ["149.154.160.0", 20],
  ["91.108.4.0", 22],
];

const encoder = new TextEncoder();

/**
 * Constant-time string comparison. Both inputs are hashed first so the
 * comparison takes the same time regardless of where (or whether) the
 * strings differ, and regardless of their lengths.
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}

export async function hasValidSecret(request: Request, expected: string): Promise<boolean> {
  const provided = request.headers.get(SECRET_HEADER);
  if (provided === null) return false;
  return timingSafeEqual(provided, expected);
}

export function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const octet = Number(p);
    if (octet > 255) return null;
    n = n * 256 + octet;
  }
  return n;
}

export function isIpInCidr(ip: string, base: string, prefix: number): boolean {
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  if (ipInt === null || baseInt === null) return false;
  const size = 2 ** (32 - prefix);
  return Math.floor(ipInt / size) === Math.floor(baseInt / size);
}

export function isTelegramIp(ip: string | null): boolean {
  if (!ip) return false;
  return TELEGRAM_CIDRS.some(([base, prefix]) => isIpInCidr(ip, base, prefix));
}

/** Cloudflare sets this header to the real client IP; clients can't spoof it. */
export function clientIp(request: Request): string | null {
  return request.headers.get("CF-Connecting-IP");
}
