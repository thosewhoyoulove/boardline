import { fetchJson, readJsonFixture } from "@/lib/crawlers/public-json";
import { buildChineseJob, FRONTEND_QUERY, mapFrontendJobs, parseChineseDate, readPageSize } from "@/lib/crawlers/text";
import type { AdapterContext, AdapterFetchResult, CrawlerAdapter, NormalizedJob } from "@/lib/crawlers/types";

const SOURCE_TYPE = "didi_api";
const SCOPE = "social";
const FIXTURE = "fixtures/cn/didi.sample.json";
const ORIGIN = "https://talent.didiglobal.com";

type DidiJob = {
  jdId?: number | string;
  jobName?: string;
  workArea?: string | null;
  jobTypeName?: string | null;
  jobDuty?: string | null;
  jobQualification?: string | null;
  refreshTime?: string | null;
  createTime?: string | null;
};

function asJob(value: unknown): DidiJob | null {
  if (!value || typeof value !== "object") return null;
  return value as DidiJob;
}

export function normalizeDidiJob(value: unknown): NormalizedJob | null {
  const job = asJob(value);
  if (job?.jdId == null || !job.jobName) return null;
  const id = String(job.jdId).trim();
  return buildChineseJob({
    sourceType: SOURCE_TYPE,
    scope: SCOPE,
    externalId: id,
    title: job.jobName,
    category: job.jobTypeName,
    locations: [job.workArea],
    responsibility: job.jobDuty,
    requirement: job.jobQualification,
    officialUrl: `${ORIGIN}/social/jobDetail?jdId=${encodeURIComponent(id)}`,
    publishTime: parseChineseDate(job.refreshTime || job.createTime),
  });
}

export function normalizeDidiJobs(values: unknown[]): NormalizedJob[] {
  return mapFrontendJobs(values, "滴滴", (value) => {
    const title = asJob(value)?.jobName?.trim();
    if (!title) return null;
    return { title, job: normalizeDidiJob(value) };
  });
}

async function loadFixture(note: string): Promise<AdapterFetchResult> {
  const payload = await readJsonFixture(FIXTURE);
  const items = payload && typeof payload === "object" ? (payload as { data?: { items?: unknown } }).data?.items : null;
  if (!Array.isArray(items)) throw new Error(`没有可用的离线样例 ${FIXTURE}`);
  return { jobs: normalizeDidiJobs(items), authoritative: false, note };
}

async function fetchLive(pageSize: number): Promise<AdapterFetchResult> {
  const url = new URL(`${ORIGIN}/recruit-portal-service/api/job/front/list`);
  url.searchParams.set("page", "1");
  url.searchParams.set("size", String(pageSize));
  url.searchParams.set("jobName", FRONTEND_QUERY);
  const payload = (await fetchJson(url.toString(), {
    headers: {
      referer: `${ORIGIN}/social/list`,
      origin: ORIGIN,
    },
  })) as { data?: { items?: unknown } };
  const items = payload.data?.items;
  if (!Array.isArray(items)) throw new Error("滴滴职位列表缺少 data.items");
  return {
    jobs: normalizeDidiJobs(items),
    authoritative: true,
    note: `滴滴招聘公开接口，前端社招最近 ${items.length} 条`,
  };
}

export const didiApiAdapter: CrawlerAdapter = {
  sourceType: SOURCE_TYPE,
  async fetchJobs(context: AdapterContext): Promise<AdapterFetchResult> {
    if (context.offline) return loadFixture(`离线样例 ${FIXTURE}`);
    try {
      return await fetchLive(readPageSize(context.config));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "未知错误";
      try {
        return await loadFixture(`接口失败，改用离线样例（${reason}）`);
      } catch {
        throw error;
      }
    }
  },
};
