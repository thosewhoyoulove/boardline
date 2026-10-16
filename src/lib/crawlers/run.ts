import { getAdapter } from "@/lib/crawlers/registry";
import { ensureDemoCompanies } from "@/lib/db/seed";
import { getPrisma } from "@/lib/db/client";
import { upsertNormalizedJobs } from "@/lib/db/upsert";
import { withCrawlSettings } from "@/lib/crawlers/public-json";
import { readCrawlSettings } from "@/lib/crawlers/settings";
import { withScrapeLease } from "@/lib/crawlers/lease";

export type ScrapeSourceResult = {
  company: string;
  sourceType: string;
  ok: boolean;
  fetched: number;
  upserted: number;
  deactivated: number;
  authoritative: boolean;
  status: "complete" | "partial" | "fixture" | "failed";
  note?: string;
  error?: string;
};

export type ScrapeReport = {
  ok: boolean;
  offline: boolean;
  companies: number;
  sourcesCreated: number;
  results: ScrapeSourceResult[];
  elapsedMs: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ScrapeOptions = { offline?: boolean; companies?: string[] };

export async function runScrape(options: ScrapeOptions = {}): Promise<ScrapeReport> {
  return withScrapeLease((assertHeld) => runScrapeWithLease(options, assertHeld));
}

async function runScrapeWithLease(options: ScrapeOptions, assertHeld: () => Promise<void>): Promise<ScrapeReport> {
  const started = Date.now();
  const offline = Boolean(options.offline);
  const ensured = await ensureDemoCompanies();
  const sources = await getPrisma().dataSource.findMany({
    where: { isActive: true, company: { active: true, ...(options.companies?.length ? { slug: { in: options.companies } } : {}) } },
    include: { company: true },
    orderBy: { company: { displayName: "asc" } },
  });
  if (options.companies?.length && sources.length === 0) throw new Error("指定公司不存在或已停用");

  const results: ScrapeSourceResult[] = [];

  for (const [index, source] of sources.entries()) {
    if (index > 0) await sleep(800);

    const adapter = getAdapter(source.sourceType);
    if (!adapter) {
      results.push({
        company: source.company.displayName,
        sourceType: source.sourceType,
        ok: false,
        fetched: 0,
        upserted: 0,
        deactivated: 0,
        authoritative: false,
        status: "failed",
        error: `没有注册适配器：${source.sourceType}`,
      });
      continue;
    }

    try {
      await assertHeld();
      const fetched = await withCrawlSettings(readCrawlSettings(source.config), () =>
        adapter.fetchJobs({ config: source.config, offline }));
      await assertHeld();
      const written = await upsertNormalizedJobs({
        companyId: source.companyId,
        sourceId: source.id,
        jobs: fetched.jobs,
        authoritative: fetched.authoritative,
      });
      results.push({
        company: source.company.displayName,
        sourceType: source.sourceType,
        ok: offline || fetched.authoritative,
        status: offline ? "fixture" : fetched.authoritative ? "complete" : "partial",
        fetched: fetched.jobs.length,
        upserted: written.upserted,
        deactivated: written.deactivated,
        authoritative: fetched.authoritative,
        note: fetched.note,
      });
    } catch (error) {
      results.push({
        company: source.company.displayName,
        sourceType: source.sourceType,
        ok: false,
        fetched: 0,
        upserted: 0,
        deactivated: 0,
        authoritative: false,
        status: "failed",
        error: error instanceof Error ? error.message : "抓取失败",
      });
    }
  }

  const failures = results.filter((result) => !result.ok).length;
  return {
    ok: failures === 0,
    offline,
    companies: ensured.companies,
    sourcesCreated: ensured.sourcesCreated,
    results,
    elapsedMs: Date.now() - started,
  };
}

export function formatScrapeReport(report: ScrapeReport): string {
  const lines = [
    report.offline ? "职线抓取开始（离线样例）" : "职线抓取开始",
    `已确认示例公司 ${report.companies} 家，新建数据源 ${report.sourcesCreated} 个`,
  ];

  for (const result of report.results) {
    if (result.status === "failed") {
      lines.push(`[${result.company}] ${result.sourceType} 失败：${result.error}`);
      continue;
    }
    const mode = result.status === "complete" ? "完整扫描，仅下线超过宽限期的缺失职位"
      : result.status === "fixture" ? "离线样例，保留旧岗位" : "部分扫描，保留旧岗位";
    lines.push(
      `[${result.company}] ${result.sourceType} 取得 ${result.fetched} 条，写入 ${result.upserted}，下线 ${result.deactivated}（${mode}）${result.note ? ` — ${result.note}` : ""}`,
    );
  }

  lines.push(`完成，耗时 ${(report.elapsedMs / 1000).toFixed(1)}s`);
  return lines.join("\n");
}
