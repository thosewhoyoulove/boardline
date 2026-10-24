import { collectPages, pageTotal } from "@/lib/crawlers/pagination";
import { readCrawlSettings } from "@/lib/crawlers/settings";
import { fetchJson, readJsonFixture } from "@/lib/crawlers/public-json";
import { buildChineseJob, FRONTEND_QUERY, mapFrontendJobs, parsePostedAt, readPageSize, splitPlaces } from "@/lib/crawlers/text";
import type { AdapterContext, AdapterFetchResult, CrawlerAdapter, NormalizedJob } from "@/lib/crawlers/types";

const SOURCE_TYPE = "netease_api";
const SCOPE = "social";
const FIXTURE = "fixtures/cn/netease.sample.json";
const ORIGIN = "https://hr.163.com";

type NeteaseJob = {
  id?: number | string;
  name?: string;
  workType?: string | number | null;
  firstPostTypeName?: string | null;
  requirement?: string | null;
  description?: string | null;
  workPlaceNameList?: unknown;
  updateTime?: unknown;
};

function asJob(value: unknown): NeteaseJob | null {
  if (!value || typeof value !== "object") return null;
  return value as NeteaseJob;
}

function isIntern(job: NeteaseJob): boolean {
  return String(job.workType ?? "") === "1";
}

export function normalizeNeteaseJob(value: unknown): NormalizedJob | null {
  const job = asJob(value);
  if (job?.id == null || !job.name || isIntern(job)) return null;
  const id = String(job.id).trim();
  return buildChineseJob({
    sourceType: SOURCE_TYPE,
    scope: SCOPE,
    externalId: id,
    title: job.name,
    category: job.firstPostTypeName,
    locations: splitPlaces(job.workPlaceNameList),
    responsibility: job.description,
    requirement: job.requirement,
    officialUrl: `${ORIGIN}/job-detail.html?id=${encodeURIComponent(id)}&lang=zh`,
    publishTime: parsePostedAt(job.updateTime),
  });
}

export function normalizeNeteaseJobs(values: unknown[]): NormalizedJob[] {
  return mapFrontendJobs(values, "网易", (value) => {
    const job = asJob(value);
    const title = job?.name?.trim();
    if (!title) return null;
    return { title, job: normalizeNeteaseJob(value), ineligible: job ? isIntern(job) : false };
  });
}

async function loadFixture(note: string): Promise<AdapterFetchResult> {
  const payload = await readJsonFixture(FIXTURE);
  const list = payload && typeof payload === "object" ? (payload as { data?: { list?: unknown } }).data?.list : null;
  if (!Array.isArray(list)) throw new Error(`没有可用的离线样例 ${FIXTURE}`);
  return { jobs: normalizeNeteaseJobs(list), authoritative: false, note };
}

async function fetchLive(config: unknown): Promise<AdapterFetchResult> {
  const pageSize = readPageSize(config);
  const { maxPages } = readCrawlSettings(config);
  const scan = await collectPages({
    maxPages,
    identify: (item) => asJob(item)?.id,
    fetchPage: async (pageNumber) => {
      const payload = (await fetchJson(`${ORIGIN}/api/hr163/position/queryPage`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: ORIGIN,
          referer: `${ORIGIN}/job-list.html`,
        },
        body: JSON.stringify({
          currentPage: pageNumber,
          pageSize,
          keyword: FRONTEND_QUERY,
          workType: "0",
        }),
      })) as { code?: number; data?: { list?: unknown; total?: unknown } };
      const list = payload.data?.list;
      if (payload.code !== 200 || !Array.isArray(list)) throw new Error("网易职位列表缺少 data.list");
      return { items: list, total: pageTotal(payload.data?.total) };
    },
  });
  return { jobs: normalizeNeteaseJobs(scan.items), authoritative: scan.complete, note: scan.note };
}

export const neteaseApiAdapter: CrawlerAdapter = {
  sourceType: SOURCE_TYPE,
  async fetchJobs(context: AdapterContext): Promise<AdapterFetchResult> {
    if (context.offline) return loadFixture(`离线样例 ${FIXTURE}`);
    return fetchLive(context.config);
  },
};
