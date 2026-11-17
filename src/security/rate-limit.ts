/**
 * Best-effort, in-memory rate limiting and update de-duplication.
 *
 * Workers isolates are reused across requests but not shared globally, so
 * these protect against bursts (someone spamming /jio, Telegram retrying an
 * update) rather than being a hard global guarantee. That's the right trade-off
 * for a free, storage-less bot. If you need strict limits, back this with
 * Durable Objects or KV (see docs/EXTENDING.md).
 */

export class CooldownLimiter {
  readonly #lastSeen = new Map<string, number>();

  constructor(
    private readonly cooldownMs: number,
    private readonly maxKeys = 5_000,
    private readonly now: () => number = Date.now,
  ) {}

  /** Returns true if the action is allowed (and records it). */
  tryAcquire(key: string): boolean {
    const t = this.now();
    const last = this.#lastSeen.get(key);
    if (last !== undefined && t - last < this.cooldownMs) return false;

    this.#lastSeen.delete(key); // re-insert to keep Map in recency order
    this.#lastSeen.set(key, t);
    if (this.#lastSeen.size > this.maxKeys) {
      const oldest = this.#lastSeen.keys().next().value;
      if (oldest !== undefined) this.#lastSeen.delete(oldest);
    }
    return true;
  }
}

/** Remembers recently processed update_ids so retries don't create duplicate polls. */
export class RecentIds {
  readonly #ids = new Set<number>();

  constructor(private readonly capacity = 1_000) {}

  /** Returns true if the id was already seen; otherwise records it. */
  seen(id: number): boolean {
    if (this.#ids.has(id)) return true;
    this.#ids.add(id);
    if (this.#ids.size > this.capacity) {
      const oldest = this.#ids.values().next().value;
      if (oldest !== undefined) this.#ids.delete(oldest);
    }
    return false;
  }
}
