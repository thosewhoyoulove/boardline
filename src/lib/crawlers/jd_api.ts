import { collectPages } from "@/lib/crawlers/pagination";
import { readCrawlSettings } from "@/lib/crawlers/settings";
import { fetchJson, fetchResponse, readJsonFixture } from "@/lib/crawlers/public-json";
import { buildChineseJob, FRONTEND_QUERY, isFrontendRole, mapFrontendJobs, parseEpoch, readPageSize } from "@/lib/crawlers/text";
import type { AdapterContext, AdapterFetchResult, CrawlerAdapter, NormalizedJob } from "@/lib/crawlers/types";

const SOURCE_TYPE = "jd_api";
const SCOPE = "social";
const FIXTURE = "fixtures/cn/jd.sample.json";
const ORIGIN = "https://zhaopin.jd.com";
const SOCIAL_LIST = `${ORIGIN}/web/job/job_info_list/3`;

type JdJob = {
  requirementId?: number | string;
  positionNameOpen?: string | null;
  positionName?: string | null;
  jobType?: string | null;
  workCity?: string | null;
  workContent?: string | null;
  qualification?: string | null;
  publishTime?: number | null;
  positionDeptName?: string | null;
};

function asJob(value: unknown): JdJob | null {
  if (!value || typeof value !== "object") return null;
  return value as JdJob;
}

function publicTitle(job: JdJob): string {
  const openName = job.positionNameOpen?.trim() || "";
  const internalName = job.positionName?.trim() || "";
  return [openName, internalName].find((title) => isFrontendRole(title)) || openName || internalName;
}

export function normalizeJdJob(value: unknown): NormalizedJob | null {
  const job = asJob(value);
  if (job?.requirementId == null) return null;
  const title = publicTitle(job);
  if (!title) return null;
  const id = String(job.requirementId).trim();
  return buildChineseJob({
    sourceType: SOURCE_TYPE,
    scope: SCOPE,
    externalId: id,
    title,
    category: job.jobType || job.positionDeptName,
    locations: [job.workCity],
    responsibility: job.workContent,
    requirement: job.qualification,
    officialUrl: SOCIAL_LIST,
    publishTime: parseEpoch(job.publishTime),
  });
}

export function normalizeJdJobs(values: unknown[]): NormalizedJob[] {
  return mapFrontendJobs(values, "京东", (value) => {
    const job = asJob(value);
    if (!job) return null;
    const title = publicTitle(job);
    if (!title) return null;
    return { title, job: normalizeJdJob(value) };
  });
}

async function loadFixture(note: string): Promise<AdapterFetchResult> {
  const payload = await readJsonFixture(FIXTURE);
  const jobs = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? (payload as { jobs?: unknown }).jobs
      : null;
  if (!Array.isArray(jobs)) throw new Error(`没有可用的离线样例 ${FIXTURE}`);
  return { jobs: normalizeJdJobs(jobs), authoritative: false, note };
}

async function fetchLive(config: unknown): Promise<AdapterFetchResult> {
  const pageSize = readPageSize(config);
  const { maxPages } = readCrawlSettings(config);

  const home = await fetchResponse(SOCIAL_LIST, {
    headers: { accept: "text/html", "user-agent": "BoardlineBot/0.1 (public company career API; no login)" },
  });
  if (!home.ok) throw new Error(`京东招聘页 HTTP ${home.status}`);
  const cookie = (home.headers.getSetCookie?.() ?? []).map((entry) => entry.split(";")[0]).join("; ");
  await home.body?.cancel();
  const scan = await collectPages({
    maxPages,
    identify: (item) => (item as { requirementId: unknown } | null)?.requirementId,
    fetchPage: async (pageNumber) => {
      const body = new URLSearchParams({
        pageIndex: String(pageNumber),
        pageSize: String(pageSize),
        workCityJson: "[]",
        jobTypeJson: "[]",
        jobSearch: FRONTEND_QUERY,
        depTypeJson: "[]",
      });
      const payload = await fetchJson(`${ORIGIN}/web/job/job_list`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          origin: ORIGIN,
          referer: SOCIAL_LIST,
          cookie,
          "x-requested-with": "XMLHttpRequest",
        },
        body,
      });
      if (!Array.isArray(payload)) throw new Error("京东职位列表不是数组");
      return { items: payload };
    },
  });
  return {
    jobs: normalizeJdJobs(scan.items),
    authoritative: scan.complete,
    note: scan.note,
  };
}

export const jdApiAdapter: CrawlerAdapter = {
  sourceType: SOURCE_TYPE,
  async fetchJobs(context: AdapterContext): Promise<AdapterFetchResult> {
    if (context.offline) return loadFixture(`离线样例 ${FIXTURE}`);
    return fetchLive(context.config);
  },
};
