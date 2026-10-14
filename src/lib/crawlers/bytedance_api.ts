import { fetchJson, readJsonFixture } from "@/lib/crawlers/public-json";
import { buildChineseJob, FRONTEND_QUERY, mapFrontendJobs, parseEpoch, readPageSize, uniqueLocations } from "@/lib/crawlers/text";
import type { AdapterContext, AdapterFetchResult, CrawlerAdapter, NormalizedJob } from "@/lib/crawlers/types";

const SOURCE_TYPE = "bytedance_api";
const SCOPE = "social";
const FIXTURE = "fixtures/cn/bytedance.sample.json";
const ORIGIN = "https://jobs.bytedance.com";

type Named = { name?: string | null; i18n_name?: string | null };

type ByteDancePost = {
  id?: string;
  title?: string;
  description?: string | null;
  requirement?: string | null;
  job_category?: Named | null;
  city_info?: Named | null;
  city_list?: Named[] | null;
  publish_time?: number | null;
};

function labelOf(value: Named | null | undefined): string | null {
  return value?.i18n_name?.trim() || value?.name?.trim() || null;
}

export function normalizeByteDancePost(value: unknown): NormalizedJob | null {
  if (!value || typeof value !== "object") return null;
  const post = value as ByteDancePost;
  if (!post.id || !post.title) return null;

  return buildChineseJob({
    sourceType: SOURCE_TYPE,
    scope: SCOPE,
    externalId: post.id,
    title: post.title,
    category: labelOf(post.job_category),
    locations: uniqueLocations([labelOf(post.city_info), ...(post.city_list ?? []).map(labelOf)]),
    responsibility: post.description,
    requirement: post.requirement,
    officialUrl: `${ORIGIN}/experienced/position/${encodeURIComponent(post.id)}/detail`,
    publishTime: parseEpoch(post.publish_time),
  });
}

export function normalizeByteDancePosts(values: unknown[]): NormalizedJob[] {
  return mapFrontendJobs(values, "字节跳动", (value) => {
    if (!value || typeof value !== "object") return null;
    const title = (value as ByteDancePost).title?.trim();
    if (!title) return null;
    return { title, job: normalizeByteDancePost(value) };
  });
}

async function loadFixture(note: string): Promise<AdapterFetchResult> {
  const payload = await readJsonFixture(FIXTURE);
  const posts =
    payload && typeof payload === "object"
      ? (payload as { data?: { job_post_list?: unknown } }).data?.job_post_list
      : null;
  if (!Array.isArray(posts)) throw new Error(`没有可用的离线样例 ${FIXTURE}`);
  return { jobs: normalizeByteDancePosts(posts), authoritative: false, note };
}

async function fetchLive(pageSize: number): Promise<AdapterFetchResult> {
  const csrfResponse = await fetch(`${ORIGIN}/api/v1/csrf/token`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      origin: ORIGIN,
      referer: `${ORIGIN}/experienced/position`,
      "user-agent": "BoardlineBot/0.1 (public company career API; no login)",
    },
    body: JSON.stringify({ portal_entrance: 1 }),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!csrfResponse.ok) throw new Error(`字节跳动 CSRF HTTP ${csrfResponse.status}`);
  const csrf = (await csrfResponse.json()) as { data?: { token?: string } };
  const token = csrf.data?.token;
  const cookie = csrfResponse.headers.get("set-cookie")?.split(";")[0];
  if (!token || !cookie) throw new Error("字节跳动公开接口没有返回 CSRF token");

  const payload = (await fetchJson(`${ORIGIN}/api/v1/search/job/posts`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      referer: `${ORIGIN}/experienced/position`,
      "x-csrf-token": token,
      cookie,
    },
    body: JSON.stringify({
      keyword: FRONTEND_QUERY,
      limit: pageSize,
      offset: 0,
      job_category_id_list: [],
      tag_id_list: [],
      location_code_list: [],
      subject_id_list: [],
      recruitment_id_list: [],
      portal_type: 2,
      portal_entrance: 1,
    }),
  })) as { data?: { job_post_list?: unknown } };

  const posts = payload.data?.job_post_list;
  if (!Array.isArray(posts)) throw new Error("字节跳动职位列表缺少 job_post_list");
  return {
    jobs: normalizeByteDancePosts(posts),
    authoritative: true,
    note: `字节跳动招聘公开接口，前端社招最近 ${posts.length} 条`,
  };
}

export const bytedanceApiAdapter: CrawlerAdapter = {
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
