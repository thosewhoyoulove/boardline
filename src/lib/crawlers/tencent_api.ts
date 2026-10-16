import { collectPages } from "@/lib/crawlers/pagination";
import { readCrawlSettings } from "@/lib/crawlers/settings";
import { fetchJson, readJsonFixture } from "@/lib/crawlers/public-json";
import { buildChineseJob, FRONTEND_QUERY, isFrontendRole, mapFrontendJobs, parseChineseDate, readPageSize } from "@/lib/crawlers/text";
import type { AdapterContext, AdapterFetchResult, CrawlerAdapter, NormalizedJob } from "@/lib/crawlers/types";

const SOURCE_TYPE = "tencent_api";
const SCOPE = "social";
const FIXTURE = "fixtures/cn/tencent.sample.json";

type TencentPost = {
  PostId?: string;
  RecruitPostName?: string;
  CountryName?: string;
  LocationName?: string;
  CategoryName?: string;
  ProductName?: string;
  Responsibility?: string;
  Requirement?: string;
  LastUpdateTime?: string;
  PostURL?: string;
};

function asPost(value: unknown): TencentPost | null {
  if (!value || typeof value !== "object") return null;
  return value as TencentPost;
}

export function normalizeTencentPost(value: unknown): NormalizedJob | null {
  const post = asPost(value);
  if (!post?.PostId || !post.RecruitPostName) return null;
  if (post.CountryName && post.CountryName !== "中国") return null;

  const postId = post.PostId.trim();
  const upgraded = post.PostURL?.trim().replace(/^http:\/\//i, "https://");
  const officialUrl =
    upgraded && upgraded.startsWith("https://careers.tencent.com/")
      ? upgraded
      : `https://careers.tencent.com/jobdesc.html?postId=${encodeURIComponent(postId)}`;

  return buildChineseJob({
    sourceType: SOURCE_TYPE,
    scope: SCOPE,
    externalId: postId,
    title: post.RecruitPostName,
    category: post.CategoryName || post.ProductName || null,
    locations: [post.LocationName],
    responsibility: post.Responsibility,
    requirement: post.Requirement,
    officialUrl,
    publishTime: parseChineseDate(post.LastUpdateTime),
  });
}

export function normalizeTencentPosts(values: unknown[]): NormalizedJob[] {
  return mapFrontendJobs(values, "腾讯", (value) => {
    const post = asPost(value);
    const title = post?.RecruitPostName?.trim();
    if (!title) return null;
    return { title, job: normalizeTencentPost(value) };
  });
}

async function loadFixture(note: string): Promise<AdapterFetchResult> {
  const payload = await readJsonFixture(FIXTURE);
  const posts = payload && typeof payload === "object" ? (payload as { posts?: unknown }).posts : null;
  if (!Array.isArray(posts)) throw new Error(`没有可用的离线样例 ${FIXTURE}`);
  return { jobs: normalizeTencentPosts(posts), authoritative: false, note };
}

async function fetchLive(config: unknown): Promise<AdapterFetchResult> {
  const pageSize = readPageSize(config);
  const { maxPages } = readCrawlSettings(config);
  const scan = await collectPages({
    maxPages,
    identify: (item) => asPost(item)?.PostId,
    fetchPage: async (pageNumber) => {
      const listUrl = new URL("https://careers.tencent.com/tencentcareer/api/post/Query");
      listUrl.searchParams.set("pageIndex", String(pageNumber));
      listUrl.searchParams.set("pageSize", String(pageSize));
      listUrl.searchParams.set("language", "zh-cn");
      listUrl.searchParams.set("area", "cn");
      listUrl.searchParams.set("keyword", FRONTEND_QUERY);

      const list = (await fetchJson(listUrl.toString(), {
        headers: { referer: "https://careers.tencent.com/search.html" },
      })) as { Data?: { Posts?: unknown[] } };
      const posts = list.Data?.Posts;
      if (!Array.isArray(posts)) throw new Error("腾讯职位列表缺少 Data.Posts");
      return { items: posts };
    },
  });
  const posts = scan.items;

  const detailed: unknown[] = [];
  let detailErrors = 0;
  for (const entry of posts) {
    const post = asPost(entry);
    if (!post?.PostId || (post.CountryName && post.CountryName !== "中国")) continue;
    if (!isFrontendRole(post.RecruitPostName)) continue;
    const detailUrl = new URL("https://careers.tencent.com/tencentcareer/api/post/ByPostId");
    detailUrl.searchParams.set("postId", post.PostId);
    detailUrl.searchParams.set("language", "zh-cn");
    try {
      const detail = (await fetchJson(detailUrl.toString(), {
        headers: { referer: `https://careers.tencent.com/jobdesc.html?postId=${post.PostId}` },
      })) as { Data?: unknown };
      const merged = asPost(detail.Data);
      if (!merged || typeof merged.Requirement !== "string" || !merged.Requirement.trim()) {
        throw new Error("腾讯详情缺少职位要求");
      }
      detailed.push({ ...post, ...merged, CountryName: post.CountryName });
    } catch {
      detailErrors += 1;
    }
  }

  if (detailErrors > 0 && detailed.length === 0) {
    throw new Error("腾讯本轮前端职位详情全部读取失败");
  }

  return {
    jobs: normalizeTencentPosts(detailed),
    authoritative: scan.complete && detailErrors === 0,
    note: `${scan.note}${detailErrors ? `；${detailErrors} 条详情失败，保留旧岗位` : ""}`,
  };
}

export const tencentApiAdapter: CrawlerAdapter = {
  sourceType: SOURCE_TYPE,
  async fetchJobs(context: AdapterContext): Promise<AdapterFetchResult> {
    if (context.offline) return loadFixture(`离线样例 ${FIXTURE}`);
    return fetchLive(context.config);
  },
};
