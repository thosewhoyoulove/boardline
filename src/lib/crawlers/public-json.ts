import { readFile } from "node:fs/promises";
import path from "node:path";

export const PUBLIC_USER_AGENT = "BoardlineBot/0.1 (public company career API; no login)";
const REQUEST_TIMEOUT_MS = 20_000;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const headers = new Headers(init.headers);
  if (!headers.has("accept")) headers.set("accept", "application/json");
  if (!headers.has("user-agent")) headers.set("user-agent", PUBLIC_USER_AGENT);
  const response = await fetch(url, {
    ...init,
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${new URL(url).pathname}`);
  }
  return response.json() as Promise<unknown>;
}

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
