import { collectPages, pageTotal } from "@/lib/crawlers/pagination";
import { readCrawlSettings } from "@/lib/crawlers/settings";
import { fetchJson, readJsonFixture } from "@/lib/crawlers/public-json";
import { buildChineseJob, FRONTEND_QUERY, mapFrontendJobs, parsePostedAt, readPageSize, splitPlaces } from "@/lib/crawlers/text";
import type { AdapterContext, AdapterFetchResult, CrawlerAdapter, NormalizedJob } from "@/lib/crawlers/types";

const SOURCE_TYPE = "xiaohongshu_api";
const SCOPE = "social";
const FIXTURE = "fixtures/cn/xiaohongshu.sample.json";
const ORIGIN = "https://job.xiaohongshu.com";

type XiaohongshuJob = {
  positionId?: number | string;
  positionName?: string;
  workplace?: string | null;
  publishTime?: string | null;
  recruitStatus?: string | null;
  duty?: string | null;
  qualification?: string | null;
  jobType?: string | null;
};

function asJob(value: unknown): XiaohongshuJob | null {
  if (!value || typeof value !== "object") return null;
  return value as XiaohongshuJob;
}

function isClosed(job: XiaohongshuJob): boolean {
  return Boolean(job.recruitStatus && job.recruitStatus !== "in_recruitment");
}

export function normalizeXiaohongshuJob(value: unknown): NormalizedJob | null {
  const job = asJob(value);
  if (job?.positionId == null || !job.positionName || isClosed(job)) return null;
  const id = String(job.positionId).trim();
  return buildChineseJob({
    sourceType: SOURCE_TYPE,
    scope: SCOPE,
    externalId: id,
    title: job.positionName,
    category: job.jobType,
    locations: splitPlaces(job.workplace),
    responsibility: job.duty,
    requirement: job.qualification,
    officialUrl: `${ORIGIN}/social/position?positionId=${encodeURIComponent(id)}`,
    publishTime: parsePostedAt(job.publishTime),
  });
}

export function normalizeXiaohongshuJobs(values: unknown[]): NormalizedJob[] {
  return mapFrontendJobs(values, "小红书", (value) => {
    const job = asJob(value);
    const title = job?.positionName?.trim();
    if (!title) return null;
    return { title, job: normalizeXiaohongshuJob(value), ineligible: job ? isClosed(job) : false };
  });
}

async function loadFixture(note: string): Promise<AdapterFetchResult> {
  const payload = await readJsonFixture(FIXTURE);
  const list = payload && typeof payload === "object" ? (payload as { data?: { list?: unknown } }).data?.list : null;
  if (!Array.isArray(list)) throw new Error(`没有可用的离线样例 ${FIXTURE}`);
  return { jobs: normalizeXiaohongshuJobs(list), authoritative: false, note };
}

async function fetchLive(config: unknown): Promise<AdapterFetchResult> {
  const pageSize = readPageSize(config);
  const { maxPages } = readCrawlSettings(config);
  const scan = await collectPages({
    maxPages,
    identify: (item) => asJob(item)?.positionId,
    fetchPage: async (pageNumber) => {
      const payload = (await fetchJson(`${ORIGIN}/websiterecruit/position/pageQueryPosition`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: ORIGIN,
          referer: `${ORIGIN}/social/position`,
        },
        body: JSON.stringify({
          recruitType: "social",
          positionName: FRONTEND_QUERY,
          pageNum: pageNumber,
          pageSize,
        }),
      })) as { statusCode?: number; data?: { list?: unknown; total?: unknown } };
      const list = payload.data?.list;
      if (payload.statusCode !== 200 || !Array.isArray(list)) throw new Error("小红书职位列表缺少 data.list");
      return { items: list, total: pageTotal(payload.data?.total) };
    },
  });
  return { jobs: normalizeXiaohongshuJobs(scan.items), authoritative: scan.complete, note: scan.note };
}

export const xiaohongshuApiAdapter: CrawlerAdapter = {
  sourceType: SOURCE_TYPE,
  async fetchJobs(context: AdapterContext): Promise<AdapterFetchResult> {
    if (context.offline) return loadFixture(`离线样例 ${FIXTURE}`);
    return fetchLive(context.config);
  },
};
