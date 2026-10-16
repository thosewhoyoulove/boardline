const dateFormat = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "Asia/Shanghai",
});

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "日期未知";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "日期未知";
  return dateFormat.format(date);
}

const updateTimeFormat = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Shanghai",
});

export function formatUpdateTime(value: string): string {
  return updateTimeFormat.format(new Date(value));
}

export function formatLocations(locations: string[]): string {
  return locations.length > 0 ? locations.join(" · ") : "地点未标明";
}

export function isFresh(firstSeenAt: Date | string, now = Date.now()): boolean {
  const time = firstSeenAt instanceof Date ? firstSeenAt.getTime() : new Date(firstSeenAt).getTime();
  return now - time < 7 * 24 * 60 * 60 * 1000;
}

export function recruitmentLabel(value: string): string {
  if (value === "social") return "社会招聘";
  if (value === "campus") return "校园招聘";
  return value;
}

export function sourceLabel(value: string): string {
  if (value === "ashby_api") return "Ashby 公开接口";
  if (value === "tencent_api") return "腾讯招聘公开接口";
  if (value === "bytedance_api") return "字节跳动招聘公开接口";
  if (value === "meituan_api") return "美团招聘公开接口";
  if (value === "xiaomi_api") return "小米招聘公开接口";
  if (value === "alibaba_api") return "阿里巴巴招聘公开接口";
  if (value === "didi_api") return "滴滴招聘公开接口";
  if (value === "jd_api") return "京东招聘公开接口";
  if (value === "ctrip_api") return "携程招聘公开接口";
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
