import { collectPages, pageTotal } from "@/lib/crawlers/pagination";
import { fetchJson } from "@/lib/crawlers/public-json";
import { readCrawlSettings } from "@/lib/crawlers/settings";
import { buildChineseJob, isFrontendRole, parseChineseDate, parseEpoch, readPageSize } from "@/lib/crawlers/text";
import type { CrawlerAdapter, NormalizedJob } from "@/lib/crawlers/types";

type Row = Record<string, unknown>;
const object = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const idOf = (row: Row) => typeof row.id === "number" && Number.isSafeInteger(row.id) ? String(row.id) : text(row.id);

export function normalizeAdditionalJob(value: unknown, sourceType: "netease_api" | "bilibili_api"): NormalizedJob | null {
  const row = object(value);
  const netease = sourceType === "netease_api";
  const id = idOf(row);
  const title = text(netease ? row.name : row.positionName);
  // These new sources initially cover full-time frontend social hiring.
  if (!id || !isFrontendRole(title)) return null;
  if (netease ? String(row.workType) !== "0" : row.recruitType !== 0 || row.positionTypeName === "实习") return null;
  const description = text(netease ? row.description : row.positionDescription);
  const separator = /(?:工作要求|任职要求|任职资格)\s*[:：]?/;
  const split = description.search(separator);
  const places = netease && Array.isArray(row.workPlaceNameList) ? row.workPlaceNameList.filter((v): v is string => typeof v === "string") : [text(row.workCity) || text(row.workLocation)];
  return buildChineseJob({
    sourceType, scope: "social", externalId: id, title,
    category: text(netease ? row.firstPostTypeName : row.postCodeName), locations: places,
    responsibility: netease ? description : split >= 0 ? description.slice(0, split) : null,
    requirement: netease ? text(row.requirement) : split >= 0 ? description.slice(split).replace(separator, "") : description,
    officialUrl: netease ? `https://hr.163.com/job-detail.html?id=${encodeURIComponent(id)}` : `https://jobs.bilibili.com/social/positions/${encodeURIComponent(id)}`,
    publishTime: netease ? parseEpoch(row.updateTime) : parseChineseDate(text(row.pushTime) || text(row.ctime)),
  });
}

export function readAdditionalPage(payload: unknown, sourceType: string) {
  const response = object(payload);
  const expectedCode = sourceType === "netease_api" ? 200 : 0;
  if (response.code !== expectedCode) throw new Error(`${sourceType} 拒绝请求：${text(response.msg) || text(response.message) || String(response.code)}`);
  const data = object(response.data);
  if (!Array.isArray(data.list)) throw new Error(`${sourceType} 职位响应缺少 list`);
  return { items: data.list as unknown[], total: pageTotal(data.total) };
}

function createAdapter(sourceType: "netease_api" | "bilibili_api"): CrawlerAdapter {
  return { sourceType, async fetchJobs({config, offline}) {
    if (offline) throw new Error(`${sourceType} 没有离线样例，不会使用假职位`);
    const netease = sourceType === "netease_api";
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (!netease) {
      headers["X-AppKey"] = "ops.ehr-api.auth"; // Public website identifier, not a secret.
      headers["X-UserType"] = "2";
      const payload = object(await fetchJson("https://jobs.bilibili.com/api/auth/v1/csrf/token", {headers}));
      if (payload.code !== 0 || !text(payload.data)) throw new Error("B 站公开访客令牌获取失败");
      headers["X-CSRF"] = text(payload.data);
    }
    const scan = await collectPages({
      maxPages: readCrawlSettings(config).maxPages,
      identify: value => idOf(object(value)),
      fetchPage: async page => readAdditionalPage(await fetchJson(netease ? "https://hr.163.com/api/hr163/position/queryPage" : "https://jobs.bilibili.com/api/srs/position/positionList", {
        method: "POST", headers,
        body: JSON.stringify(netease
          ? {currentPage: page, pageSize: readPageSize(config), keyword: "前端", sortType: 2}
          : {pageNum: page, pageSize: readPageSize(config), positionName: "前端", recruitType: 0, workLocationList: [], positionTypeList: [], postCodeList: [], deptCodeList: []}),
      }), sourceType),
    });
    const jobs = scan.items.flatMap(value => {const job = normalizeAdditionalJob(value, sourceType); return job ? [job] : [];});
    return {jobs, authoritative: scan.complete, note: scan.note};
  }};
}

export const neteaseApiAdapter = createAdapter("netease_api");
export const bilibiliApiAdapter = createAdapter("bilibili_api");
