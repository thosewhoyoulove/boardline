import { contentHash } from "@/lib/crawlers/hash";
import { plainText, sanitizeDescription } from "@/lib/crawlers/sanitize";
import type { NormalizedJob } from "@/lib/crawlers/types";
import { safeHttpUrl } from "@/lib/http";

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
  const requirement = plainText(input.requirement);
  if (!title || !externalId || !containsChinese(requirement)) return null;

  const officialUrl = safeHttpUrl(input.officialUrl);
  if (!officialUrl?.startsWith("https://")) return null;

  const responsibility = plainText(input.responsibility);
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
