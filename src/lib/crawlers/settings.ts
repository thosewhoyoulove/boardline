export type CrawlSettings = {
  maxPages: number;
  requestDelayMs: number;
  retries: number;
  timeoutMs: number;
};

export function positiveInteger(value: unknown, fallback: number, min: number, max: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}

export function readCrawlSettings(config: unknown): CrawlSettings {
  const source = config && typeof config === "object" ? config as Record<string, unknown> : {};
  return {
    maxPages: positiveInteger(source.maxPages ?? process.env.SCRAPE_MAX_PAGES, 20, 1, 200),
    requestDelayMs: positiveInteger(source.requestDelayMs ?? process.env.SCRAPE_REQUEST_DELAY_MS, 1000, 250, 60_000),
    retries: positiveInteger(source.retries ?? process.env.SCRAPE_RETRIES, 2, 0, 5),
    timeoutMs: positiveInteger(source.timeoutMs ?? process.env.SCRAPE_TIMEOUT_MS, 20_000, 1000, 60_000),
  };
}
