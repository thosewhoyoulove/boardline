import "dotenv/config";
import { setTimeout as wait } from "node:timers/promises";
import { formatScrapeReport, runScrape } from "@/lib/crawlers/run";
import { nextScrapeDelay, readScrapeArguments } from "@/lib/crawlers/schedule";
import { getPrisma } from "@/lib/db/client";

async function main(): Promise<void> {
  const options = readScrapeArguments(process.argv.slice(2));
  const stopping = new AbortController();
  const stop = () => {
    console.log("准备退出；当前轮次完成后释放抓取锁");
    stopping.abort();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    do {
      const startedAt = Date.now();
      try {
        console.log(`抓取时间：${new Date(startedAt).toISOString()}`);
        const report = await runScrape(options);
        console.log(formatScrapeReport(report));
        if (!options.watch && !report.ok) process.exitCode = 1;
      } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        if (!options.watch) process.exitCode = 1;
      }
      if (!options.watch || stopping.signal.aborted) break;
      const delay = nextScrapeDelay(startedAt, Date.now(), options.intervalMs);
      console.log(`下次抓取：${new Date(Date.now() + delay).toISOString()}`);
      try { await wait(delay, undefined, { signal: stopping.signal }); }
      catch (error) { if (!stopping.signal.aborted) throw error; }
    } while (!stopping.signal.aborted);
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    await getPrisma().$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
