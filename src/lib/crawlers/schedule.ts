export type ScrapeCliOptions = { offline: boolean; watch: boolean; intervalMs: number; companies?: string[] };

export function readScrapeArguments(args: string[]): ScrapeCliOptions {
  let interval = process.env.SCRAPE_INTERVAL_MINUTES ?? "360";
  let offline = process.env.SCRAPE_OFFLINE === "1";
  let watch = false;
  let companies: string[] | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--offline") offline = true;
    else if (arg === "--watch") watch = true;
    else if (arg === "--interval-minutes" || arg === "--company") {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error(`${arg} 缺少参数`);
      if (arg === "--interval-minutes") interval = value;
      else {
        companies = value.split(",").map((slug) => slug.trim());
        if (companies.some((slug) => !/^[a-z0-9_-]+$/.test(slug))) throw new Error("公司 slug 格式不正确");
      }
    } else throw new Error(`未知参数：${arg}`);
  }
  const minutes = Number(interval);
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > 10_080) {
    throw new Error("抓取间隔必须为 15–10080 分钟");
  }
  if (watch && offline) throw new Error("离线样例不能用于定时抓取，请单独运行 --offline");
  return { offline, watch, intervalMs: minutes * 60_000, companies };
}

/** Skip missed slots rather than launching catch-up runs back-to-back. */
export function nextScrapeDelay(startedAt: number, finishedAt: number, intervalMs: number): number {
  const elapsed = Math.max(0, finishedAt - startedAt);
  return intervalMs - elapsed % intervalMs;
}
