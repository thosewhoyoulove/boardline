import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getAdapter } from "@/lib/crawlers/registry";
import { withCrawlSettings } from "@/lib/crawlers/public-json";
import { readCrawlSettings } from "@/lib/crawlers/settings";

const definitions = [
  { name: "tencent", id: "PostId", list: "Query", fixture: (p: Record<string, unknown>) => p.posts, wrap: (items: unknown[]) => ({ Data: { Posts: items } }) },
  { name: "bytedance", id: "id", list: "search/job/posts", fixture: (p: Record<string, unknown>) => (p.data as { job_post_list: unknown[] }).job_post_list, wrap: (items: unknown[]) => ({ data: { job_post_list: items } }) },
  { name: "xiaomi", id: "id", list: "search/job/posts", fixture: (p: Record<string, unknown>) => (p.data as { job_post_list: unknown[] }).job_post_list, wrap: (items: unknown[]) => ({ data: { job_post_list: items } }) },
  { name: "alibaba", id: "id", list: "position/search", fixture: (p: Record<string, unknown>) => (p.content as { datas: unknown[] }).datas, wrap: (items: unknown[]) => ({ content: { datas: items } }) },
  { name: "meituan", id: "jobUnionId", list: "getJobList", fixture: (p: Record<string, unknown>) => (p.data as { list: unknown[] }).list, wrap: (items: unknown[]) => ({ data: { list: items } }) },
  { name: "jd", id: "requirementId", list: "job_list", fixture: (p: Record<string, unknown>) => p.jobs, wrap: (items: unknown[]) => items },
  { name: "didi", id: "jdId", list: "front/list", fixture: (p: Record<string, unknown>) => (p.data as { items: unknown[] }).items, wrap: (items: unknown[]) => ({ data: { items } }) },
  { name: "ctrip", id: "jobId", list: "getJobAd", fixture: (p: Record<string, unknown>) => (p.retValue as { recruitJobAdList: unknown[] }).recruitJobAdList, wrap: (items: unknown[]) => ({ retCode: "201", retValue: { recruitJobAdList: items } }) },
];

for (const definition of definitions) {
  test(`${definition.name}: follows page/offset parameters and keeps all pages`, async (t) => {
    const payload = JSON.parse(readFileSync(`fixtures/cn/${definition.name}.sample.json`, "utf8"));
    const template = (definition.fixture(payload) as Record<string, unknown>[])[0];
    const requests: number[] = [];
    const rows = [1, 2].map((index) => ({ ...template, [definition.id]: `${template[definition.id]}-${index}` }));
    t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("csrf/token")) return Response.json({ data: { token: "test" } }, { headers: { "set-cookie": "csrf=test; Path=/" } });
      if (url.pathname.endsWith("ByPostId")) return Response.json({ Data: rows.find((row) => row.PostId === url.searchParams.get("postId")) });
      if (!url.pathname.endsWith(definition.list)) return new Response("", { headers: { "set-cookie": "XSRF-TOKEN=test; Path=/" } });
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      const index = definition.name === "jd" ? Number((init?.body as URLSearchParams).get("pageIndex"))
        : definition.name === "tencent" ? Number(url.searchParams.get("pageIndex"))
        : definition.name === "didi" ? Number(url.searchParams.get("page"))
        : definition.name === "meituan" ? body.page.pageNo
        : definition.name === "ctrip" ? body.pager.index
        : definition.name === "alibaba" ? body.pageIndex : body.offset + 1;
      requests.push(index);
      return Response.json(definition.wrap(index <= 2 ? [rows[index - 1]] : []));
    });
    const adapter = getAdapter(`${definition.name}_api`)!;
    const result = await withCrawlSettings(readCrawlSettings({ requestDelayMs: 250, retries: 0 }), () => adapter.fetchJobs({ config: { pageSize: 2, maxPages: 5 }, offline: false }));
    assert.deepEqual(requests, [1, 2, 3]);
    assert.equal(result.authoritative, true);
    assert.equal(result.jobs.length, 2);
  });
}

test("online failure never silently substitutes fixture jobs", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 403 }));
  await assert.rejects(getAdapter("meituan_api")!.fetchJobs({ config: {}, offline: false }), /403/);
});

test("Meituan uses totalCount to stop before its null out-of-range page", async (t) => {
  const payload = JSON.parse(readFileSync("fixtures/cn/meituan.sample.json", "utf8"));
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    assert.equal(calls, 1);
    return Response.json({ status: 1, data: { list: [payload.data.list[0]], page: { totalCount: 1 } } });
  });
  const result = await getAdapter("meituan_api")!.fetchJobs({ config: {}, offline: false });
  assert.equal(result.authoritative, true);
  assert.equal(result.jobs.length, 1);
});
