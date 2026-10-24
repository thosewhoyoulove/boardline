import { collectPages, pageTotal } from "@/lib/crawlers/pagination";
import { readCrawlSettings } from "@/lib/crawlers/settings";
import { fetchJson, readJsonFixture } from "@/lib/crawlers/public-json";
import { buildChineseJob, mapFrontendJobs, parsePostedAt, readPageSize, splitPlaces } from "@/lib/crawlers/text";
import type { AdapterContext, AdapterFetchResult, CrawlerAdapter, NormalizedJob } from "@/lib/crawlers/types";

const SOURCE_TYPE = "huawei_api";
const SCOPE = "social";
const FIXTURE = "fixtures/cn/huawei.sample.json";
const SITE = "https://career.huawei.com";
const API = "https://apigw-dgg-b0.huawei.com";
/** App id embedded in the public career site. It is not a credential. */
const PUBLIC_APP_ID = "app_000000035886";

const MAINLAND = /北京|上海|深圳|广州|杭州|成都|南京|武汉|西安|东莞|苏州|厦门|合肥|重庆|天津|长沙|青岛|大连|沈阳|郑州|佛山|无锡|宁波|福州|济南|昆明|哈尔滨|长春|石家庄|南昌|贵阳|太原|南宁|海口|兰州|中国|大陆/;
const OUTSIDE_MAINLAND = /新加坡|美国|日本|德国|法国|英国|加拿大|澳大利亚|印度|韩国|迪拜|欧洲|北美|拉美|海外|境外|香港|澳门|台湾/;

type HuaweiJob = {
  jobId?: number | string;
  jobName?: string | null;
  jobFamilyName?: string | null;
  jobRequire?: string | null;
  mainBusiness?: string | null;
  workPlace?: string | null;
  cityName?: string | null;
  countryName?: string | null;
  workCountry?: string | null;
  lastUpdateDate?: string | null;
  deployDate?: string | null;
  releaseDate?: string | null;
};

function asJob(value: unknown): HuaweiJob | null {
  if (!value || typeof value !== "object") return null;
  return value as HuaweiJob;
}

function placesOf(job: HuaweiJob): string[] {
  return splitPlaces([job.workPlace, job.cityName, job.countryName, job.workCountry]);
}

/** Social listings include overseas posts. Keep mainland cities and unlabeled rows. */
export function isMainlandHuawei(value: unknown): boolean {
  const job = asJob(value);
  if (!job) return false;
  const text = placesOf(job).join("");
  if (!text) return true;
  if (MAINLAND.test(text)) return true;
  return !OUTSIDE_MAINLAND.test(text);
}

export function normalizeHuaweiJob(value: unknown): NormalizedJob | null {
  const job = asJob(value);
  if (job?.jobId == null || !job.jobName || !isMainlandHuawei(job)) return null;
  const id = String(job.jobId).trim();
  return buildChineseJob({
    sourceType: SOURCE_TYPE,
    scope: SCOPE,
    externalId: id,
    title: job.jobName,
    category: job.jobFamilyName,
    locations: splitPlaces([job.workPlace, job.cityName]),
    responsibility: job.mainBusiness,
    requirement: job.jobRequire,
    officialUrl: `${SITE}/cn/social-recruitment-job-list?jobId=${encodeURIComponent(id)}`,
    publishTime: parsePostedAt(job.lastUpdateDate || job.deployDate || job.releaseDate),
  });
}

export function normalizeHuaweiJobs(values: unknown[]): NormalizedJob[] {
  return mapFrontendJobs(values, "华为", (value) => {
    const job = asJob(value);
    const title = job?.jobName?.trim();
    if (!title) return null;
    const abroad = Boolean(job && !isMainlandHuawei(job));
    return { title, job: normalizeHuaweiJob(value), ineligible: abroad };
  });
}

async function loadFixture(note: string): Promise<AdapterFetchResult> {
  const payload = await readJsonFixture(FIXTURE);
  const list = payload && typeof payload === "object" ? (payload as { data?: { result?: unknown } }).data?.result : null;
  if (!Array.isArray(list)) throw new Error(`没有可用的离线样例 ${FIXTURE}`);
  return { jobs: normalizeHuaweiJobs(list), authoritative: false, note };
}

async function fetchLive(config: unknown): Promise<AdapterFetchResult> {
  const pageSize = readPageSize(config);
  const { maxPages } = readCrawlSettings(config);
  const endpoint = `${API}/api/apig/channelhw/recruitmentPosition/pub/getJobPage?X-HW-ID=${PUBLIC_APP_ID}`;
  const scan = await collectPages({
    maxPages,
    identify: (item) => asJob(item)?.jobId,
    fetchPage: async (pageNumber) => {
      const payload = (await fetchJson(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: SITE,
          referer: `${SITE}/`,
          "x-hw-id": PUBLIC_APP_ID,
          "x-jalor-tenantalias": "hcm",
          "x-language": "zh_CN",
          "x-referer": `${SITE}/cn`,
        },
        body: JSON.stringify({ curPage: pageNumber, pageSize, jobType: "SR" }),
      })) as { status?: string; data?: { pageVO?: { totalRows?: unknown }; result?: unknown } };
      const list = payload.data?.result;
      if (payload.status !== "SUCCESS" || !Array.isArray(list)) {
        throw new Error("华为职位列表缺少 result");
      }
      return { items: list, total: pageTotal(payload.data?.pageVO?.totalRows) };
    },
  });
  return {
    jobs: normalizeHuaweiJobs(scan.items),
    authoritative: scan.complete,
    note: `${scan.note}；社招列表无关键词参数，本地筛选前端职位`,
  };
}

export const huaweiApiAdapter: CrawlerAdapter = {
  sourceType: SOURCE_TYPE,
  async fetchJobs(context: AdapterContext): Promise<AdapterFetchResult> {
    if (context.offline) return loadFixture(`离线样例 ${FIXTURE}`);
    return fetchLive(context.config);
  },
};
