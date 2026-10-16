import { fetchJson } from "@/lib/crawlers/public-json";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { contentHash } from "@/lib/crawlers/hash";
import { htmlToText, plainText, sanitizeDescription } from "@/lib/crawlers/sanitize";
import type { AdapterContext, AdapterFetchResult, CrawlerAdapter, NormalizedJob } from "@/lib/crawlers/types";
import { safeHttpUrl } from "@/lib/http";

const SOURCE_TYPE = "ashby_api";
const USER_AGENT = "BoardlineBot/0.1 (+https://localhost; public Ashby posting API; no login)";

type AshbySecondaryLocation = {
  location?: string | null;
};

type AshbyJob = {
  id?: string;
  title?: string;
  department?: string | null;
  team?: string | null;
  location?: string | null;
  secondaryLocations?: AshbySecondaryLocation[] | null;
  publishedAt?: string | null;
  isListed?: boolean | null;
  workplaceType?: string | null;
  jobUrl?: string | null;
  applyUrl?: string | null;
  descriptionHtml?: string | null;
  descriptionPlain?: string | null;
};

export function readAshbyConfig(config: unknown): { boardSlug: string } {
  if (!config || typeof config !== "object") {
    throw new Error("ashby_api config 必须是对象");
  }
  const boardSlug = (config as { boardSlug?: unknown }).boardSlug;
  if (typeof boardSlug !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/.test(boardSlug)) {
    throw new Error("ashby_api config.boardSlug 缺失或格式不正确");
  }
  return { boardSlug };
}

function uniqueLocations(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function parsePublishTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeAshbyPayload(payload: unknown, boardSlug: string): NormalizedJob[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { jobs?: unknown }).jobs)) {
    throw new Error(`Ashby 返回缺少 jobs 数组（board: ${boardSlug}）`);
  }

  const jobs = (payload as { jobs: unknown[] }).jobs;
  const normalized: NormalizedJob[] = [];

  for (const entry of jobs) {
    if (!entry || typeof entry !== "object") continue;
    const job = entry as AshbyJob;
    if (job.isListed === false) continue;

    const externalId = job.id?.trim();
    const title = job.title?.trim();
    if (!externalId || !title) continue;

    const officialUrl = safeHttpUrl(job.applyUrl) ?? safeHttpUrl(job.jobUrl);
    if (!officialUrl) continue;

    const locations = uniqueLocations([
      job.location,
      ...(job.secondaryLocations ?? []).map((item) => item?.location),
      job.workplaceType === "Remote" ? "Remote" : null,
    ]);

    const category = job.department?.trim() || job.team?.trim() || null;
    const descriptionHtml = sanitizeDescription(job.descriptionHtml);
    const descriptionText = plainText(job.descriptionPlain) ?? htmlToText(descriptionHtml);

    normalized.push({
      uniqueKey: `${SOURCE_TYPE}:${boardSlug}:${externalId}`,
      externalId,
      title,
      category,
      locations,
      descriptionHtml,
      descriptionText,
      officialUrl,
      publishTime: parsePublishTime(job.publishedAt),
      contentHash: contentHash({
        title,
        category,
        locations,
        descriptionHtml,
        officialUrl,
      }),
    });
  }

  if (jobs.length > 0 && normalized.length === 0) {
    throw new Error(`Ashby 返回了 ${jobs.length} 条职位，但没有一条能规范化（board: ${boardSlug}）`);
  }

  return normalized;
}

export async function loadAshbyFixture(boardSlug: string): Promise<unknown | null> {
  const file = path.join(process.cwd(), "fixtures", "ashby", `${boardSlug}.sample.json`);
  try {
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw) as unknown;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw error;
  }
}

async function fetchAshbyBoard(boardSlug: string): Promise<unknown> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(boardSlug)}`;
  return fetchJson(url, { headers: { "user-agent": USER_AGENT } });
}

async function fromFixture(boardSlug: string, note: string): Promise<AdapterFetchResult> {
  const payload = await loadAshbyFixture(boardSlug);
  if (!payload) {
    throw new Error(`没有可用的离线样例 fixtures/ashby/${boardSlug}.sample.json`);
  }
  return {
    jobs: normalizeAshbyPayload(payload, boardSlug),
    authoritative: false,
    note,
  };
}

export const ashbyApiAdapter: CrawlerAdapter = {
  sourceType: SOURCE_TYPE,
  async fetchJobs(context: AdapterContext): Promise<AdapterFetchResult> {
    const { boardSlug } = readAshbyConfig(context.config);
    if (context.offline) {
      return fromFixture(boardSlug, `离线样例 fixtures/ashby/${boardSlug}.sample.json`);
    }

    const payload = await fetchAshbyBoard(boardSlug);
    return {
      jobs: normalizeAshbyPayload(payload, boardSlug),
      authoritative: true,
      note: "Ashby 公开 posting API",
    };
  },
};
