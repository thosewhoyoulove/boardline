import { collectPages, pageTotal } from "@/lib/crawlers/pagination";
import { readCrawlSettings } from "@/lib/crawlers/settings";
import { fetchJson, readJsonFixture } from "@/lib/crawlers/public-json";
import { buildChineseJob, FRONTEND_QUERY, mapFrontendJobs, parseEpoch, readPageSize } from "@/lib/crawlers/text";
import type { AdapterContext, AdapterFetchResult, CrawlerAdapter, NormalizedJob } from "@/lib/crawlers/types";

const SOURCE_TYPE = "meituan_api";
const SCOPE = "social";
const FIXTURE = "fixtures/cn/meituan.sample.json";
const ORIGIN = "https://zhaopin.meituan.com";

type MeituanJob = {
  jobUnionId?: string;
  name?: string;
  jobFamily?: string | null;
  jobDuty?: string | null;
  jobRequirement?: string | null;
  refreshTime?: number | null;
  cityList?: Array<{ name?: string | null }> | null;
};

export function normalizeMeituanJob(value: unknown): NormalizedJob | null {
  if (!value || typeof value !== "object") return null;
  const job = value as MeituanJob;
  if (!job.jobUnionId || !job.name) return null;
  const id = job.jobUnionId.trim();
  return buildChineseJob({
    sourceType: SOURCE_TYPE,
    scope: SCOPE,
    externalId: id,
    title: job.name,
    category: job.jobFamily,
    locations: (job.cityList ?? []).map((city) => city?.name),
    responsibility: job.jobDuty,
    requirement: job.jobRequirement,
    officialUrl: `${ORIGIN}/web/position/detail?jobUnionId=${encodeURIComponent(id)}&jobShareType=1&highlightType=social`,
    publishTime: parseEpoch(job.refreshTime),
  });
}

export function normalizeMeituanJobs(values: unknown[]): NormalizedJob[] {
  return mapFrontendJobs(values, "美团", (value) => {
    if (!value || typeof value !== "object") return null;
    const title = (value as MeituanJob).name?.trim();
    if (!title) return null;
    return { title, job: normalizeMeituanJob(value) };
  });
}

async function loadFixture(note: string): Promise<AdapterFetchResult> {
  const payload = await readJsonFixture(FIXTURE);
  const list = payload && typeof payload === "object" ? (payload as { data?: { list?: unknown } }).data?.list : null;
  if (!Array.isArray(list)) throw new Error(`没有可用的离线样例 ${FIXTURE}`);
  return { jobs: normalizeMeituanJobs(list), authoritative: false, note };
}

async function fetchLive(config: unknown): Promise<AdapterFetchResult> {
  const pageSize = readPageSize(config);
  const { maxPages } = readCrawlSettings(config);

  const scan = await collectPages({
    maxPages,
    identify: (item) => (item as { jobUnionId: unknown } | null)?.jobUnionId,
    fetchPage: async (pageNumber) => {
      const payload = (await fetchJson(`${ORIGIN}/api/official/job/getJobList`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: ORIGIN,
          referer: `${ORIGIN}/web/social`,
        },
        body: JSON.stringify({
          page: { pageNo: pageNumber, pageSize },
          jobShareType: "1",
          keywords: FRONTEND_QUERY,
          jobType: [{ code: "3", subCode: [] }],
        }),
      })) as { status?: number; data?: { list?: unknown; page?: { totalCount?: unknown } } };

      const list = payload.data?.list;
      if ((payload.status !== undefined && payload.status !== 1) || !Array.isArray(list)) {
        throw new Error("美团职位列表缺少有效的 data.list");
      }
      return { items: list, total: pageTotal(payload.data?.page?.totalCount) };
    },
  });
  return {
    jobs: normalizeMeituanJobs(scan.items),
    authoritative: scan.complete,
    note: scan.note,
  };
}

export const meituanApiAdapter: CrawlerAdapter = {
  sourceType: SOURCE_TYPE,
  async fetchJobs(context: AdapterContext): Promise<AdapterFetchResult> {
    if (context.offline) return loadFixture(`离线样例 ${FIXTURE}`);
    return fetchLive(context.config);
  },
};
