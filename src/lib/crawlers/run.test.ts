import assert from "node:assert/strict";
import test from "node:test";
import { formatScrapeReport, scrapeRefreshUseful, type ScrapeReport, type ScrapeSourceResult } from "@/lib/crawlers/run";

function source(status: ScrapeSourceResult["status"], company: string, sourceType: string): ScrapeSourceResult {
  return {
    company,
    sourceType,
    ok: status !== "failed",
    fetched: status === "failed" ? 0 : 4,
    upserted: status === "failed" ? 0 : 4,
    deactivated: 0,
    authoritative: status === "complete",
    status,
    note: status === "partial" ? "已读取 2 页、27 条原始职位；已到列表末尾" : undefined,
    error: status === "failed" ? "来源不可用" : undefined,
  };
}

test("one failed or partial source does not fail a useful refresh", () => {
  assert.equal(scrapeRefreshUseful([source("partial", "腾讯", "tencent_api"), source("complete", "小米", "xiaomi_api")]), true);
  assert.equal(scrapeRefreshUseful([source("failed", "腾讯", "tencent_api"), source("partial", "字节跳动", "bytedance_api")]), true);
  assert.equal(scrapeRefreshUseful([source("failed", "腾讯", "tencent_api"), source("failed", "京东", "jd_api")]), false);
  assert.equal(scrapeRefreshUseful([]), true);
});

test("the report logs a skipped source and keeps the successful writes", () => {
  const report: ScrapeReport = {
    ok: scrapeRefreshUseful([source("failed", "腾讯", "tencent_api"), source("complete", "小米", "xiaomi_api")]),
    offline: false,
    companies: 8,
    sourcesCreated: 0,
    elapsedMs: 1500,
    results: [source("failed", "腾讯", "tencent_api"), source("complete", "小米", "xiaomi_api")],
  };
  const text = formatScrapeReport(report);
  assert.equal(report.ok, true);
  assert.match(text, /\[腾讯\] tencent_api 失败：来源不可用/);
  assert.match(text, /\[小米\] xiaomi_api 取得 4 条，写入 4/);
  assert.match(text, /1 个来源失败已跳过，其余来源已写入/);
});
