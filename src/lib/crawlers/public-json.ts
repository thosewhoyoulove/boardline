import { AsyncLocalStorage } from "node:async_hooks";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readCrawlSettings, type CrawlSettings } from "@/lib/crawlers/settings";

export const PUBLIC_USER_AGENT = "BoardlineBot/0.1 (public company career API; no login)";
const settings = new AsyncLocalStorage<CrawlSettings>();
export const withCrawlSettings = <T>(policy: CrawlSettings, task: () => Promise<T>): Promise<T> => settings.run(policy, task);

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function retryAfterMs(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

/** All endpoints using this client are read-only, including search POSTs. */
export function createPublicClient(dependencies: {
  fetch?: typeof fetch;
  sleep?: typeof sleep;
  now?: () => number;
  random?: () => number;
} = {}) {
  const request = dependencies.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const wait = dependencies.sleep ?? sleep;
  const now = dependencies.now ?? Date.now;
  const random = dependencies.random ?? Math.random;
  const slots = new Map<string, { tail: Promise<void>; nextAt: number }>();

  async function fetchResponse(url: string, init: RequestInit = {}): Promise<Response> {
    const policy = settings.getStore() ?? readCrawlSettings(undefined);
    const origin = new URL(url).origin;
    let slot = slots.get(origin);
    if (!slot) { slot = { tail: Promise.resolve(), nextAt: 0 }; slots.set(origin, slot); }
    const previous = slot.tail;
    let release!: () => void;
    slot.tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      const headers = new Headers(init.headers);
      if (!headers.has("accept")) headers.set("accept", "application/json");
      if (!headers.has("user-agent")) headers.set("user-agent", PUBLIC_USER_AGENT);
      for (let attempt = 0; ; attempt += 1) {
        const delay = slot.nextAt - now();
        if (delay > 60_000) throw new Error(`来源正在限流冷却：${origin}`);
        if (delay > 0) await wait(delay);
        slot.nextAt = now() + policy.requestDelayMs + Math.floor(random() * 250);
        let response: Response;
        try {
          response = await request(url, {
            ...init, headers, cache: "no-store",
            signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(policy.timeoutMs)]) : AbortSignal.timeout(policy.timeoutMs),
          });
        } catch (error) {
          if (init.signal?.aborted || attempt >= policy.retries) throw error;
          slot.nextAt = Math.max(slot.nextAt, now() + 1000 * 2 ** attempt);
          continue;
        }
        if (response.ok) return response;
        const retryable = [408, 425, 429, 500, 502, 503, 504].includes(response.status);
        const backoff = Math.max(1000 * 2 ** attempt, retryAfterMs(response.headers.get("retry-after"), now()) ?? 0);
        await response.body?.cancel();
        if (retryable) slot.nextAt = Math.max(slot.nextAt, now() + backoff);
        if (!retryable || attempt >= policy.retries || backoff > 60_000) {
          throw new Error(`HTTP ${response.status} ${new URL(url).pathname}${backoff > 60_000 ? "（按 Retry-After 暂停该来源）" : ""}`);
        }
      }
    } finally { release(); }
  }

  async function fetchJson(url: string, init: RequestInit = {}): Promise<unknown> {
    return (await fetchResponse(url, init)).json() as Promise<unknown>;
  }
  return { fetchResponse, fetchJson };
}

export const { fetchResponse, fetchJson } = createPublicClient();

export async function readJsonFixture(relativePath: string): Promise<unknown | null> {
  const file = path.join(process.cwd(), relativePath);
  try {
    return JSON.parse(await readFile(file, "utf8")) as unknown;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw error;
  }
}
