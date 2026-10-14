import { fetchJson, readJsonFixture } from "@/lib/crawlers/public-json";
import { buildChineseJob, FRONTEND_QUERY, mapFrontendJobs, parseChineseDate, readPageSize } from "@/lib/crawlers/text";
import type { AdapterContext, AdapterFetchResult, CrawlerAdapter, NormalizedJob } from "@/lib/crawlers/types";

const SOURCE_TYPE = "ctrip_api";
const SCOPE = "social";
const FIXTURE = "fixtures/cn/ctrip.sample.json";
const ORIGIN = "https://job.ctrip.com";

type CtripJob = {
  jobId?: string;
  jobTitle?: string;
  cityName?: string | null;
  requirements?: string | null;
  duty?: string | null;
  publishDate?: string | null;
  kindName?: string | null;
  jobFamilyGroupName?: string | null;
  buName?: string | null;
};

function asJob(value: unknown): CtripJob | null {
  if (!value || typeof value !== "object") return null;
  return value as CtripJob;
}

function displayTitle(title: string): string {
  return title.replace(/\s*\(MJ\d+\)\s*$/i, "").trim();
}

function isCampus(job: CtripJob): boolean {
  return /fresh graduate/i.test(job.kindName ?? "");
}

export function normalizeCtripJob(value: unknown): NormalizedJob | null {
  const job = asJob(value);
  if (!job?.jobId || !job.jobTitle || isCampus(job)) return null;
  const id = job.jobId.trim();
  return buildChineseJob({
    sourceType: SOURCE_TYPE,
    scope: SCOPE,
    externalId: id,
    title: displayTitle(job.jobTitle),
    category: job.jobFamilyGroupName || job.buName,
    locations: [job.cityName],
    responsibility: job.duty,
    requirement: job.requirements,
    officialUrl: `${ORIGIN}/job-detail/${encodeURIComponent(id)}`,
    publishTime: parseChineseDate(job.publishDate),
  });
}

export function normalizeCtripJobs(values: unknown[]): NormalizedJob[] {
  return mapFrontendJobs(values, "携程", (value) => {
    const job = asJob(value);
    const title = job?.jobTitle ? displayTitle(job.jobTitle) : "";
    if (!title) return null;
    return { title, job: normalizeCtripJob(value), ineligible: job ? isCampus(job) : false };
  });
}

async function loadFixture(note: string): Promise<AdapterFetchResult> {
  const payload = await readJsonFixture(FIXTURE);
  const list =
    payload && typeof payload === "object"
      ? (payload as { retValue?: { recruitJobAdList?: unknown } }).retValue?.recruitJobAdList
      : null;
  if (!Array.isArray(list)) throw new Error(`没有可用的离线样例 ${FIXTURE}`);
  return { jobs: normalizeCtripJobs(list), authoritative: false, note };
}

async function fetchLive(pageSize: number): Promise<AdapterFetchResult> {
  const payload = (await fetchJson(`${ORIGIN}/api/hrrecruit/getJobAd`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      referer: `${ORIGIN}/experienced/jobList`,
    },
    body: JSON.stringify({
      condition: {
        keyword: FRONTEND_QUERY,
        city: [],
        country: [],
        jobCategory: [],
        fromId: [],
      },
      pager: { size: pageSize, index: 1 },
    }),
  })) as { retCode?: string; retValue?: { recruitJobAdList?: unknown } };

  const list = payload.retValue?.recruitJobAdList;
  if (payload.retCode !== "201" || !Array.isArray(list)) {
    throw new Error("携程职位列表缺少 recruitJobAdList");
  }
  return {
    jobs: normalizeCtripJobs(list),
    authoritative: true,
    note: `携程招聘公开接口，前端社招最近 ${list.length} 条`,
  };
}

export const ctripApiAdapter: CrawlerAdapter = {
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
