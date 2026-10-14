import { fetchJson, PUBLIC_USER_AGENT, readJsonFixture } from "@/lib/crawlers/public-json";
import { buildChineseJob, FRONTEND_QUERY, mapFrontendJobs, parseEpoch, readPageSize } from "@/lib/crawlers/text";
import type { AdapterContext, AdapterFetchResult, CrawlerAdapter, NormalizedJob } from "@/lib/crawlers/types";

const SOURCE_TYPE = "alibaba_api";
const SCOPE = "social";
const FIXTURE = "fixtures/cn/alibaba.sample.json";
const ORIGIN = "https://talent.alibaba.com";

type AlibabaPost = {
  id?: number | string;
  name?: string;
  categories?: string[] | null;
  requirement?: string | null;
  description?: string | null;
  workLocations?: string[] | null;
  publishTime?: number | null;
  categoryType?: string | null;
};

function isCampusCategory(value: string | null | undefined): boolean {
  return /campus|intern|graduate|校招|实习/i.test(value ?? "");
}

function asPost(value: unknown): AlibabaPost | null {
  if (!value || typeof value !== "object") return null;
  return value as AlibabaPost;
}

export function normalizeAlibabaPost(value: unknown): NormalizedJob | null {
  const post = asPost(value);
  if (!post?.id || !post.name) return null;
  if (isCampusCategory(post.categoryType)) return null;
  const id = String(post.id).trim();
  return buildChineseJob({
    sourceType: SOURCE_TYPE,
    scope: SCOPE,
    externalId: id,
    title: post.name,
    category: post.categories?.find((item) => item?.trim()) ?? null,
    locations: post.workLocations ?? [],
    responsibility: post.description,
    requirement: post.requirement,
    officialUrl: `${ORIGIN}/off-campus/position-detail?positionId=${encodeURIComponent(id)}&lang=zh`,
    publishTime: parseEpoch(post.publishTime),
  });
}

export function normalizeAlibabaPosts(values: unknown[]): NormalizedJob[] {
  return mapFrontendJobs(values, "阿里巴巴", (value) => {
    const post = asPost(value);
    const title = post?.name?.trim();
    if (!title) return null;
    const campus = isCampusCategory(post?.categoryType);
    return { title, job: normalizeAlibabaPost(value), ineligible: campus };
  });
}

async function loadFixture(note: string): Promise<AdapterFetchResult> {
  const payload = await readJsonFixture(FIXTURE);
  const datas = payload && typeof payload === "object" ? (payload as { content?: { datas?: unknown } }).content?.datas : null;
  if (!Array.isArray(datas)) throw new Error(`没有可用的离线样例 ${FIXTURE}`);
  return { jobs: normalizeAlibabaPosts(datas), authoritative: false, note };
}

async function fetchLive(pageSize: number): Promise<AdapterFetchResult> {
  const page = await fetch(`${ORIGIN}/off-campus/position-list?lang=zh`, {
    headers: {
      accept: "text/html",
      "user-agent": PUBLIC_USER_AGENT,
      referer: ORIGIN,
    },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!page.ok) throw new Error(`阿里巴巴招聘页 HTTP ${page.status}`);
  const cookies = page.headers.getSetCookie?.() ?? [];
  const cookie = cookies.map((entry) => entry.split(";")[0]).join("; ");
  const rawToken = cookies.find((entry) => entry.startsWith("XSRF-TOKEN="));
  const token = rawToken ? decodeURIComponent(rawToken.split(";")[0].slice("XSRF-TOKEN=".length)) : "";
  if (!cookie || !token) throw new Error("阿里巴巴公开页面没有返回 XSRF token");

  const payload = (await fetchJson(`${ORIGIN}/position/search`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      referer: `${ORIGIN}/off-campus/position-list?lang=zh`,
      cookie,
      "x-xsrf-token": token,
    },
    body: JSON.stringify({
      channel: "group_official_site",
      language: "zh",
      pageIndex: 1,
      pageSize,
      key: FRONTEND_QUERY,
      categoryType: "social",
    }),
  })) as { content?: { datas?: unknown } };

  const datas = payload.content?.datas;
  if (!Array.isArray(datas)) throw new Error("阿里巴巴职位列表缺少 content.datas");
  return {
    jobs: normalizeAlibabaPosts(datas),
    authoritative: true,
    note: `阿里巴巴招聘公开接口，前端社招最近 ${datas.length} 条`,
  };
}

export const alibabaApiAdapter: CrawlerAdapter = {
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
