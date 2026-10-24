import assert from "node:assert/strict";
import test from "node:test";

import { boardQueryFromParams, filterJobs } from "@/lib/board-query";
import { boardHref, readCompanySlugs } from "@/lib/format";

const jobs = [
  { title: "前端开发", companyName: "百度", companySlug: "baidu", category: "技术", locations: ["北京"], descriptionText: "中文" },
  { title: "前端开发", companyName: "网易", companySlug: "netease", category: "技术", locations: ["杭州"], descriptionText: "中文" },
  { title: "前端开发", companyName: "华为", companySlug: "huawei", category: "研发", locations: ["深圳"], descriptionText: "中文" },
];

test("reads one or many company slugs and ignores invalid values", () => {
  assert.deepEqual(readCompanySlugs(["Baidu,netease", "baidu", "not a slug", ""]), ["baidu", "netease"]);
  const params = new URLSearchParams("company=baidu&company=huawei&q=react");
  assert.deepEqual(boardQueryFromParams(params).companies, ["baidu", "huawei"]);
  assert.equal(boardHref({ companies: ["netease", "baidu"], q: "前端" }), "/?q=%E5%89%8D%E7%AB%AF&company=netease%2Cbaidu");
});

test("filters jobs by any selected company", () => {
  const query = { q: "", companies: ["huawei", "baidu"], location: "", page: 1 };
  assert.deepEqual(filterJobs(jobs, query).map((job) => job.companySlug), ["baidu", "huawei"]);
  assert.equal(filterJobs(jobs, { ...query, companies: [], location: "深圳" }).length, 1);
});
