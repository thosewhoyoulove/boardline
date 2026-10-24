import { collectPages, pageTotal } from "@/lib/crawlers/pagination";
import { readCrawlSettings } from "@/lib/crawlers/settings";
import { fetchJson, readJsonFixture } from "@/lib/crawlers/public-json";
import { buildChineseJob, FRONTEND_QUERY, mapFrontendJobs, parsePostedAt, readPageSize, splitPlaces } from "@/lib/crawlers/text";
import type { AdapterContext, AdapterFetchResult, CrawlerAdapter, NormalizedJob } from "@/lib/crawlers/types";

const SOURCE_TYPE = "baidu_api";
const SCOPE = "social";
const FIXTURE = "fixtures/cn/baidu.sample.json";
const ORIGIN = "https://talent.baidu.com";

type BaiduPost = {
  postId?: string;
  name?: string;
  postType?: string | null;
  serviceCondition?: string | null;
  workContent?: string | null;
  workPlace?: string | null;
  publishDate?: string | null;
  updateDate?: string | null;
};

function asPost(value: unknown): BaiduPost | null {
  if (!value || typeof value !== "object") return null;
  return value as BaiduPost;
}

export function normalizeBaiduPost(value: unknown): NormalizedJob | null {
  const post = asPost(value);
  if (!post?.postId || !post.name) return null;
  const id = post.postId.trim();
  return buildChineseJob({
    sourceType: SOURCE_TYPE,
    scope: SCOPE,
    externalId: id,
    title: post.name,
    category: post.postType,
    locations: splitPlaces(post.workPlace),
    responsibility: post.workContent,
    requirement: post.serviceCondition,
    officialUrl: `${ORIGIN}/jobs/detail/SOCIAL/${encodeURIComponent(id)}`,
    publishTime: parsePostedAt(post.updateDate || post.publishDate),
  });
}

export function normalizeBaiduPosts(values: unknown[]): NormalizedJob[] {
  return mapFrontendJobs(values, "百度", (value) => {
    const title = asPost(value)?.name?.trim();
    if (!title) return null;
    return { title, job: normalizeBaiduPost(value) };
  });
}

async function loadFixture(note: string): Promise<AdapterFetchResult> {
  const payload = await readJsonFixture(FIXTURE);
  const list = payload && typeof payload === "object" ? (payload as { data?: { list?: unknown } }).data?.list : null;
  if (!Array.isArray(list)) throw new Error(`没有可用的离线样例 ${FIXTURE}`);
  return { jobs: normalizeBaiduPosts(list), authoritative: false, note };
}

async function fetchLive(config: unknown): Promise<AdapterFetchResult> {
  const pageSize = readPageSize(config);
  const { maxPages } = readCrawlSettings(config);
  const scan = await collectPages({
    maxPages,
    identify: (item) => asPost(item)?.postId,
    fetchPage: async (pageNumber) => {
      const body = new URLSearchParams({
        recruitType: "SOCIAL",
        pageSize: String(pageSize),
        keyWord: FRONTEND_QUERY,
        curPage: String(pageNumber),
        projectType: "",
      });
      const payload = (await fetchJson(`${ORIGIN}/httservice/getPostListNew`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          origin: ORIGIN,
          referer: `${ORIGIN}/jobs/social-list`,
        },
        body,
      })) as { status?: string; data?: { total?: unknown; list?: unknown } };
      const list = payload.data?.list;
      if (payload.status !== "ok" || !Array.isArray(list)) throw new Error("百度职位列表缺少 data.list");
      return { items: list, total: pageTotal(payload.data?.total) };
    },
  });
  return { jobs: normalizeBaiduPosts(scan.items), authoritative: scan.complete, note: scan.note };
}

export const baiduApiAdapter: CrawlerAdapter = {
  sourceType: SOURCE_TYPE,
  async fetchJobs(context: AdapterContext): Promise<AdapterFetchResult> {
    if (context.offline) return loadFixture(`离线样例 ${FIXTURE}`);
    return fetchLive(context.config);
  },
};
