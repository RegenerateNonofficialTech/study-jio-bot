import type {
  BotCommand,
  Message,
  SendMessageParams,
  SendPollParams,
  WebhookInfo,
} from "./types";

/**
 * Error from the Telegram Bot API.
 *
 * SECURITY: the message never contains the request URL, because the URL
 * contains the bot token. Only the method name and Telegram's description.
 */
export class TelegramApiError extends Error {
  constructor(
    readonly method: string,
    readonly errorCode: number,
    readonly description: string,
  ) {
    super(`Telegram API ${method} failed (${errorCode}): ${description}`);
    this.name = "TelegramApiError";
  }
}

interface ApiResponse<T> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
}

export interface TelegramClientOptions {
  /** Injected for tests. Defaults to the global fetch. */
  fetch?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
}

/** Tiny zero-dependency Telegram Bot API client. */
export class TelegramClient {
  readonly #token: string; // private field: not enumerable, not serialised by JSON.stringify
  readonly #fetch: typeof fetch;
  readonly #baseUrl: string;
  readonly #timeoutMs: number;

  constructor(token: string, options: TelegramClientOptions = {}) {
    this.#token = token;
    this.#fetch = options.fetch ?? ((...args) => fetch(...args));
    this.#baseUrl = options.baseUrl ?? "https://api.telegram.org";
    this.#timeoutMs = options.timeoutMs ?? 8_000;
  }

  async call<T>(method: string, params: object = {}): Promise<T> {
    let res: Response;
    try {
      res = await this.#fetch(`${this.#baseUrl}/bot${this.#token}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
    } catch (err) {
      // Network errors can include the URL in their message — don't propagate it.
      const kind = err instanceof Error ? err.name : "UnknownError";
      throw new TelegramApiError(method, 0, `network error (${kind})`);
    }

    let data: ApiResponse<T>;
    try {
      data = (await res.json()) as ApiResponse<T>;
    } catch {
      throw new TelegramApiError(method, res.status, "non-JSON response");
    }

    if (!data.ok || data.result === undefined) {
      throw new TelegramApiError(
        method,
        data.error_code ?? res.status,
        data.description ?? "unknown error",
      );
    }
    return data.result;
  }

  sendMessage(params: SendMessageParams): Promise<Message> {
    return this.call<Message>("sendMessage", params);
  }

  sendPoll(params: SendPollParams): Promise<Message> {
    return this.call<Message>("sendPoll", params);
  }

  setMyCommands(commands: BotCommand[]): Promise<true> {
    return this.call<true>("setMyCommands", { commands });
  }

  setWebhook(params: {
    url: string;
    secret_token: string;
    allowed_updates: string[];
    drop_pending_updates?: boolean;
    max_connections?: number;
  }): Promise<true> {
    return this.call<true>("setWebhook", params);
  }

  getWebhookInfo(): Promise<WebhookInfo> {
    return this.call<WebhookInfo>("getWebhookInfo");
  }
}
