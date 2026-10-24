import { collectPages, pageTotal } from "@/lib/crawlers/pagination";
import { readCrawlSettings } from "@/lib/crawlers/settings";
import { fetchJson, fetchResponse, readJsonFixture } from "@/lib/crawlers/public-json";
import { buildChineseJob, FRONTEND_QUERY, mapFrontendJobs, parsePostedAt, readPageSize, splitPlaces, splitRoleText } from "@/lib/crawlers/text";
import type { AdapterContext, AdapterFetchResult, CrawlerAdapter, NormalizedJob } from "@/lib/crawlers/types";

const SOURCE_TYPE = "bilibili_api";
const SCOPE = "social";
const FIXTURE = "fixtures/cn/bilibili.sample.json";
const ORIGIN = "https://jobs.bilibili.com";
/** Public app key sent by the careers site. It is not a credential. */
const PUBLIC_APP_KEY = "ops.ehr-api.auth";

type BilibiliJob = {
  id?: number | string;
  positionName?: string;
  positionDescription?: string | null;
  postCodeName?: string | null;
  workLocation?: unknown;
  pushTime?: string | null;
  recruitType?: number | string | null;
};

function asJob(value: unknown): BilibiliJob | null {
  if (!value || typeof value !== "object") return null;
  return value as BilibiliJob;
}

function cookieHeader(response: Response): string {
  const listed = response.headers.getSetCookie?.() ?? [];
  const parts = listed.length > 0 ? listed : [response.headers.get("set-cookie") ?? ""];
  return parts.map((item) => item.split(";")[0]?.trim()).filter(Boolean).join("; ");
}

export function normalizeBilibiliJob(value: unknown): NormalizedJob | null {
  const job = asJob(value);
  if (job?.id == null || !job.positionName) return null;
  if (job.recruitType != null && String(job.recruitType) !== "0") return null;
  const id = String(job.id).trim();
  const sections = splitRoleText(job.positionDescription);
  return buildChineseJob({
    sourceType: SOURCE_TYPE,
    scope: SCOPE,
    externalId: id,
    title: job.positionName,
    category: job.postCodeName,
    locations: splitPlaces(job.workLocation),
    responsibility: sections.responsibility,
    requirement: sections.requirement,
    officialUrl: `${ORIGIN}/social/positions/${encodeURIComponent(id)}?isTrusted=true`,
    publishTime: parsePostedAt(job.pushTime),
  });
}

export function normalizeBilibiliJobs(values: unknown[]): NormalizedJob[] {
  return mapFrontendJobs(values, "哔哩哔哩", (value) => {
    const job = asJob(value);
    const title = job?.positionName?.trim();
    if (!title) return null;
    const campus = job?.recruitType != null && String(job.recruitType) !== "0";
    return { title, job: normalizeBilibiliJob(value), ineligible: campus };
  });
}

async function loadFixture(note: string): Promise<AdapterFetchResult> {
  const payload = await readJsonFixture(FIXTURE);
  const list = payload && typeof payload === "object" ? (payload as { data?: { list?: unknown } }).data?.list : null;
  if (!Array.isArray(list)) throw new Error(`没有可用的离线样例 ${FIXTURE}`);
  return { jobs: normalizeBilibiliJobs(list), authoritative: false, note };
}

async function fetchLive(config: unknown): Promise<AdapterFetchResult> {
  const pageSize = readPageSize(config);
  const { maxPages } = readCrawlSettings(config);
  const headers = {
    origin: ORIGIN,
    referer: `${ORIGIN}/social/positions?isTrusted=true`,
    "x-appkey": PUBLIC_APP_KEY,
    "x-usertype": "2",
    "x-channel": "social",
  };
  const csrfResponse = await fetchResponse(`${ORIGIN}/api/auth/v1/csrf/token`, { headers });
  if (!csrfResponse.ok) throw new Error(`哔哩哔哩 CSRF HTTP ${csrfResponse.status}`);
  const csrf = (await csrfResponse.json()) as { code?: number; data?: unknown };
  const token = typeof csrf.data === "string" ? csrf.data : "";
  const cookie = cookieHeader(csrfResponse);
  if (csrf.code !== 0 || !token) throw new Error("哔哩哔哩公开接口没有返回 CSRF token");

  const scan = await collectPages({
    maxPages,
    identify: (item) => asJob(item)?.id,
    fetchPage: async (pageNumber) => {
      const payload = (await fetchJson(`${ORIGIN}/api/srs/position/positionList`, {
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/json",
          "x-csrf": token,
          ...(cookie ? { cookie } : {}),
        },
        body: JSON.stringify({
          pageSize,
          pageNum: pageNumber,
          positionName: FRONTEND_QUERY,
          postCode: "",
          postCodeList: "",
          workLocationList: "",
          workTypeList: [3],
          positionTypeList: "3",
        }),
      })) as { code?: number; data?: { list?: unknown; total?: unknown } };
      const list = payload.data?.list;
      if (payload.code !== 0 || !Array.isArray(list)) throw new Error("哔哩哔哩职位列表缺少 data.list");
      return { items: list, total: pageTotal(payload.data?.total) };
    },
  });
  return { jobs: normalizeBilibiliJobs(scan.items), authoritative: scan.complete, note: scan.note };
}

export const bilibiliApiAdapter: CrawlerAdapter = {
  sourceType: SOURCE_TYPE,
  async fetchJobs(context: AdapterContext): Promise<AdapterFetchResult> {
    if (context.offline) return loadFixture(`离线样例 ${FIXTURE}`);
    return fetchLive(context.config);
  },
};
