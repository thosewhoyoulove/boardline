import { collectPages } from "@/lib/crawlers/pagination";
import { readCrawlSettings } from "@/lib/crawlers/settings";
import { fetchJson, fetchResponse, readJsonFixture } from "@/lib/crawlers/public-json";
import { buildChineseJob, FRONTEND_QUERY, mapFrontendJobs, parseEpoch, readPageSize, uniqueLocations } from "@/lib/crawlers/text";
import type { AdapterContext, AdapterFetchResult, CrawlerAdapter, NormalizedJob } from "@/lib/crawlers/types";

const SOURCE_TYPE = "xiaomi_api";
const SCOPE = "social";
const FIXTURE = "fixtures/cn/xiaomi.sample.json";
const ORIGIN = "https://xiaomi.jobs.f.mioffice.cn";

type Named = { name?: string | null; i18n_name?: string | null };

type XiaomiPost = {
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

export function normalizeXiaomiPost(value: unknown): NormalizedJob | null {
  if (!value || typeof value !== "object") return null;
  const post = value as XiaomiPost;
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
    officialUrl: `${ORIGIN}/index/position/${encodeURIComponent(post.id)}/detail`,
    publishTime: parseEpoch(post.publish_time),
  });
}

export function normalizeXiaomiPosts(values: unknown[]): NormalizedJob[] {
  return mapFrontendJobs(values, "小米", (value) => {
    if (!value || typeof value !== "object") return null;
    const title = (value as XiaomiPost).title?.trim();
    if (!title) return null;
    return { title, job: normalizeXiaomiPost(value) };
  });
}

async function loadFixture(note: string): Promise<AdapterFetchResult> {
  const payload = await readJsonFixture(FIXTURE);
  const posts =
    payload && typeof payload === "object"
      ? (payload as { data?: { job_post_list?: unknown } }).data?.job_post_list
      : null;
  if (!Array.isArray(posts)) throw new Error(`没有可用的离线样例 ${FIXTURE}`);
  return { jobs: normalizeXiaomiPosts(posts), authoritative: false, note };
}

async function fetchLive(config: unknown): Promise<AdapterFetchResult> {
  const pageSize = readPageSize(config);
  const { maxPages } = readCrawlSettings(config);

  const csrfResponse = await fetchResponse(`${ORIGIN}/api/v1/csrf/token`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      origin: ORIGIN,
      referer: `${ORIGIN}/index`,
      "user-agent": "BoardlineBot/0.1 (public company career API; no login)",
    },
    body: JSON.stringify({ portal_entrance: 1 }),
  });
  if (!csrfResponse.ok) throw new Error(`小米 CSRF HTTP ${csrfResponse.status}`);
  const csrf = (await csrfResponse.json()) as { data?: { token?: string } };
  const token = csrf.data?.token;
  const cookie = csrfResponse.headers.get("set-cookie")?.split(";")[0];
  if (!token || !cookie) throw new Error("小米公开接口没有返回 CSRF token");

  const scan = await collectPages({
    maxPages,
    identify: (item) => (item as { id: unknown } | null)?.id,
    fetchPage: async (_pageNumber, offset) => {
      const payload = (await fetchJson(`${ORIGIN}/api/v1/search/job/posts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: ORIGIN,
          referer: `${ORIGIN}/index`,
          "x-csrf-token": token,
          cookie,
        },
        body: JSON.stringify({
          keyword: FRONTEND_QUERY,
          limit: pageSize,
          offset,
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
      if (!Array.isArray(posts)) throw new Error("小米职位列表缺少 job_post_list");
      return { items: posts };
    },
  });
  return {
    jobs: normalizeXiaomiPosts(scan.items),
    authoritative: scan.complete,
    note: scan.note,
  };
}

export const xiaomiApiAdapter: CrawlerAdapter = {
  sourceType: SOURCE_TYPE,
  async fetchJobs(context: AdapterContext): Promise<AdapterFetchResult> {
    if (context.offline) return loadFixture(`离线样例 ${FIXTURE}`);
    return fetchLive(context.config);
  },
};
