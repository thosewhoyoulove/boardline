import { getAdapter } from "@/lib/crawlers/registry";
import { ensureDemoCompanies } from "@/lib/db/seed";
import { getPrisma } from "@/lib/db/client";
import { upsertNormalizedJobs } from "@/lib/db/upsert";

export type ScrapeSourceResult = {
  company: string;
  sourceType: string;
  ok: boolean;
  fetched: number;
  upserted: number;
  deactivated: number;
  authoritative: boolean;
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

export async function runScrape(options: { offline?: boolean } = {}): Promise<ScrapeReport> {
  const started = Date.now();
  const offline = Boolean(options.offline);
  const ensured = await ensureDemoCompanies();
  const sources = await getPrisma().dataSource.findMany({
    where: { isActive: true, company: { active: true } },
    include: { company: true },
    orderBy: { company: { displayName: "asc" } },
  });

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
        error: `没有注册适配器：${source.sourceType}`,
      });
      continue;
    }

    try {
      const fetched = await adapter.fetchJobs({ config: source.config, offline });
      const written = await upsertNormalizedJobs({
        companyId: source.companyId,
        sourceId: source.id,
        jobs: fetched.jobs,
        authoritative: fetched.authoritative,
      });
      results.push({
        company: source.company.displayName,
        sourceType: source.sourceType,
        ok: true,
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
    if (!result.ok) {
      lines.push(`[${result.company}] ${result.sourceType} 失败：${result.error}`);
      continue;
    }
    const mode = result.authoritative ? "权威列表，已同步下线" : "非权威样例，未下线缺失职位";
    lines.push(
      `[${result.company}] ${result.sourceType} 取得 ${result.fetched} 条，写入 ${result.upserted}，下线 ${result.deactivated}（${mode}）${result.note ? ` — ${result.note}` : ""}`,
    );
  }

  lines.push(`完成，耗时 ${(report.elapsedMs / 1000).toFixed(1)}s`);
  return lines.join("\n");
}
