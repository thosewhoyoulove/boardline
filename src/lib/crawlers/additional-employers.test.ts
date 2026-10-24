import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeAdditionalJob, readAdditionalPage, bilibiliApiAdapter } from "@/lib/crawlers/additional-employers";
import { validateDiscoveredJobs } from "@/lib/crawlers/discover";

const netease = {id: 123, name: "高级前端开发工程师", workType: "0", firstPostTypeName: "技术", workPlaceNameList: ["杭州"], requirement: "熟悉 React 与 TypeScript，有复杂项目经验。", description: "负责前端业务开发", updateTime: 1792746000000};
test("new employers normalize official links, requirements and social-hire roles", () => {
  const job = normalizeAdditionalJob(netease, "netease_api")!;
  assert.equal(job.officialUrl, "https://hr.163.com/job-detail.html?id=123");
  assert.deepEqual(job.locations, ["杭州"]);
  assert.equal(normalizeAdditionalJob({...netease, workType: "1"}, "netease_api"), null);
  assert.equal(normalizeAdditionalJob({...netease, name: "前端开发实习生"}, "netease_api"), null);
  assert.equal(normalizeAdditionalJob({...netease, requirement: "English only"}, "netease_api"), null);
  const bili = normalizeAdditionalJob({id: 25021, positionName: "资深前端工程师", positionTypeName: "全职", recruitType: 0, workLocation: "上海", positionDescription: "工作职责：负责业务系统。工作要求：熟悉 React 与 TypeScript。"}, "bilibili_api")!;
  assert.equal(bili.officialUrl, "https://jobs.bilibili.com/social/positions/25021");
  assert.match(bili.descriptionText!, /熟悉 React/);
  assert.equal(normalizeAdditionalJob({id: 1, recruitType: 1, positionName: "前端工程师"}, "bilibili_api"), null);
});
test("login/error payloads are never treated as an exhausted empty page", () => {
  assert.throws(() => readAdditionalPage({code: -101, data: null, message: "no session"}, "bilibili_api"), /no session/);
  assert.throws(() => readAdditionalPage({code: 200, data: {}}, "netease_api"), /list/);
});
test("discovery rejects off-site or empty details and duplicate identities", () => {
  const job = normalizeAdditionalJob(netease, "netease_api")!;
  const prefix = "https://hr.163.com/job-detail.html?id=";
  validateDiscoveredJobs([job], prefix);
  assert.throws(() => validateDiscoveredJobs([{...job, officialUrl: "https://hr.163.com.evil.test/job-detail.html?id=123"}], prefix));
  assert.throws(() => validateDiscoveredJobs([job, job], prefix));
  assert.throws(() => validateDiscoveredJobs([{...job, descriptionText: ""}], prefix));
});
test("Bilibili obtains a fresh public CSRF token and uses it for read-only search", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/csrf/token")) return Response.json({code: 0, data: "public-visitor-token"});
    assert.equal(new Headers(init?.headers).get("x-csrf"), "public-visitor-token");
    assert.equal(JSON.parse(String(init?.body)).recruitType, 0);
    return Response.json({code: 0, data: {list: [], total: 0}});
  };
  try {
    const result = await bilibiliApiAdapter.fetchJobs({offline: false, config: {maxPages: 1}});
    assert.equal(result.authoritative, true);
    assert.deepEqual(result.jobs, []);
  } finally {globalThis.fetch = originalFetch;}
});
