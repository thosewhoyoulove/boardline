const dateFormat = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "Asia/Shanghai",
});

export function formatDate(value: Date | null | undefined): string {
  if (!value) return "日期未知";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "日期未知";
  return dateFormat.format(date);
}

export function formatLocations(locations: string[]): string {
  return locations.length > 0 ? locations.join(" · ") : "地点未标明";
}

export function isFresh(firstSeenAt: Date, now = Date.now()): boolean {
  return now - firstSeenAt.getTime() < 7 * 24 * 60 * 60 * 1000;
}

export function recruitmentLabel(value: string): string {
  if (value === "social") return "社会招聘";
  if (value === "campus") return "校园招聘";
  return value;
}

export function sourceLabel(value: string): string {
  if (value === "ashby_api") return "Ashby 公开接口";
  return value;
}

export function readQueryValue(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim().slice(0, 80);
}

export function readCompanySlug(value: string | string[] | undefined): string {
  const raw = readQueryValue(value).toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,79}$/.test(raw) ? raw : "";
}

export function readPage(value: string | string[] | undefined): number {
  const parsed = Number.parseInt(readQueryValue(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, 10_000);
}

export function boardHref(input: {
  q?: string;
  company?: string;
  location?: string;
  page?: number;
}): string {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.company) params.set("company", input.company);
  if (input.location) params.set("location", input.location);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}
