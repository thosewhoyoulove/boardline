import { contentHash } from "@/lib/crawlers/hash";
import { htmlToText, plainText, sanitizeDescription } from "@/lib/crawlers/sanitize";
import type { NormalizedJob } from "@/lib/crawlers/types";
import { safeHttpUrl } from "@/lib/http";

/** Keyword sent to public career search APIs. Title filtering is stricter than this. */
export const FRONTEND_QUERY = "前端";

const FRONTEND_TITLE = /(前端|front[\s-]?end)/i;
const NOT_FRONTEND_TITLE =
  /产品|运营|销售|市场|招聘专员|商务|测试|算法|后端|服务端|客户端|安卓|android|\bios\b|安全工程师|设计师|视觉设计|交互设计|运维|硬件|芯片|特效|美术|策划|客服|财务|法务|人力资源|行政|采购|供应链|品牌|公关|编辑|主播|分析师|数据科学|数据开发|数据工程|标注|评测|实习|校招|秋招|春招|应届|校园招聘|20\d{2}届|偏前端|懂前端|熟悉前端|了解前端|前端优先|前端相关|前端经验|前端背景/i;

export function isFrontendRole(title: string | null | undefined): boolean {
  const value = title?.trim() ?? "";
  if (!value || NOT_FRONTEND_TITLE.test(value)) return false;
  return FRONTEND_TITLE.test(value);
}

export function containsChinese(value: string | null | undefined): boolean {
  return Boolean(value && /[\u4e00-\u9fff]/.test(value));
}

export function readPageSize(config: unknown, fallback = 24): number {
  const raw =
    config && typeof config === "object" ? (config as { pageSize?: unknown }).pageSize : undefined;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(40, Math.floor(parsed)));
}

export function uniqueLocations(values: Array<string | null | undefined>): string[] {
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

export function parseChineseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = value.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (match) {
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseEpoch(value: unknown): Date | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const ms = parsed < 1e12 ? parsed * 1000 : parsed;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function sectionsToHtml(
  sections: Array<{ title: string; body: string | null | undefined }>,
): string | null {
  const chunks: string[] = [];
  for (const section of sections) {
    const body = section.body?.trim();
    if (!body) continue;
    const paragraphs = body
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join("");
    chunks.push(`<h2>${escapeHtml(section.title)}</h2>${paragraphs}`);
  }
  if (chunks.length === 0) return null;
  return sanitizeDescription(chunks.join(""));
}

export function asPlain(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/<\/?[a-z][^>]*>/i.test(value)) return htmlToText(value);
  return plainText(value);
}

export function mapFrontendJobs(
  values: unknown[],
  sourceLabel: string,
  read: (value: unknown) => { title: string; job: NormalizedJob | null; ineligible?: boolean } | null,
): NormalizedJob[] {
  const jobs: NormalizedJob[] = [];
  let readable = 0;
  let frontend = 0;
  for (const value of values) {
    const row = read(value);
    const title = row?.title.trim();
    if (!title) continue;
    readable += 1;
    if (row?.ineligible || !isFrontendRole(title)) continue;
    frontend += 1;
    if (row?.job) jobs.push(row.job);
  }
  if (values.length > 0 && readable === 0) {
    throw new Error(`${sourceLabel}返回了职位，但没有可识别的职位名称`);
  }
  if (frontend > 0 && jobs.length === 0) {
    throw new Error(`${sourceLabel}返回了前端职位，但没有中文职位要求可收录`);
  }
  return jobs;
}

export function buildChineseJob(input: {
  sourceType: string;
  scope: string;
  externalId: string;
  title: string;
  category: string | null | undefined;
  locations: Array<string | null | undefined>;
  responsibility: string | null | undefined;
  requirement: string | null | undefined;
  officialUrl: string;
  publishTime: Date | null;
}): NormalizedJob | null {
  const title = input.title.trim();
  const externalId = input.externalId.trim();
  const requirement = asPlain(input.requirement);
  if (!title || !externalId || !isFrontendRole(title) || !containsChinese(requirement)) return null;

  const officialUrl = safeHttpUrl(input.officialUrl);
  if (!officialUrl?.startsWith("https://")) return null;

  const responsibility = asPlain(input.responsibility);
  const descriptionHtml = sectionsToHtml([
    { title: "职位职责", body: responsibility },
    { title: "职位要求", body: requirement },
  ]);
  const descriptionText = [responsibility, requirement].filter(Boolean).join("\n\n") || null;
  const category = input.category?.trim() || null;
  const locations = uniqueLocations(input.locations);

  return {
    uniqueKey: `${input.sourceType}:${input.scope}:${externalId}`,
    externalId,
    title,
    category,
    locations,
    descriptionHtml,
    descriptionText,
    officialUrl,
    publishTime: input.publishTime,
    contentHash: contentHash({
      title,
      category,
      locations,
      descriptionHtml,
      officialUrl,
    }),
  };
}
