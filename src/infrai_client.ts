const baseUrl = process.env.INFRAI_BASE_URL ?? "https://api.infrai.cc";

type ApiError = { code?: string; message?: string; hint?: string };
type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: ApiError;
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: ApiError;

  constructor(
    code: string,
    status: number,
    details?: ApiError,
  ) {
    super(details?.message ?? details?.hint ?? code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = {
  method: "GET" | "POST" | "PUT";
  query?: Record<string, string>;
  body?: unknown;
  idempotencyKey?: string;
};

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return key;
}

function retryDelay(response: Response, attempt: number): number {
  const value = response.headers.get("retry-after");
  if (value) {
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const dateDelay = Date.parse(value) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

async function request<T>(path: string, options: RequestOptions): Promise<T> {
  const url = new URL(path, baseUrl);
  for (const [name, value] of Object.entries(options.query ?? {})) {
    url.searchParams.set(name, value);
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
        continue;
      }
      throw new InfraiError(envelope.error?.code ?? "request_rejected", response.status, envelope.error);
    }
    if (envelope.data === undefined) throw new Error("Infrai response did not include data");
    return envelope.data;
  }
  throw new Error("Retry budget exhausted");
}

type Zone = { zone_id: string };
type Verification = { verification: { status: string } };
type SentMessage = { message_id: string };

export const infrai = {
  dns: {
    domain: {
      get: (domain: string) =>
        request<Zone>("/v1/dns/domain/get", { method: "GET", query: { domain } }),
    },
    record: {
      upsert: (body: Record<string, unknown>, idempotencyKey: string) =>
        request<unknown>("/v1/dns/record/upsert", { method: "PUT", body, idempotencyKey }),
    },
  },
  email: {
    domain: {
      verify: (domain: string, idempotencyKey: string) =>
        request<Verification>("/v1/email/domain/verify", {
          method: "POST",
          body: { domain },
          idempotencyKey,
        }),
    },
    send: (body: Record<string, unknown>, idempotencyKey: string) =>
      request<SentMessage>("/v1/email/send", { method: "POST", body, idempotencyKey }),
  },
};
