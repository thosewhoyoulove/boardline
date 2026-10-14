import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeByteDancePosts } from "@/lib/crawlers/bytedance_api";
import { normalizeMeituanJobs } from "@/lib/crawlers/meituan_api";
import { normalizeTencentPosts } from "@/lib/crawlers/tencent_api";

test("keeps Tencent roles with Chinese requirements and drops English ones", () => {
  const payload = JSON.parse(readFileSync("fixtures/cn/tencent.sample.json", "utf8")) as { posts: unknown[] };
  const jobs = normalizeTencentPosts(payload.posts);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, "游戏特效设计师");
  assert.equal(jobs[0].locations[0], "深圳");
  assert.equal(jobs[0].officialUrl, "https://careers.tencent.com/jobdesc.html?postId=sample-tencent-design");
  assert.match(jobs[0].descriptionHtml ?? "", /职位要求/);
  assert.match(jobs[0].descriptionText ?? "", /中文需求文档/);
  assert.equal(jobs[0].descriptionHtml?.includes("<script"), false);
});

test("normalizes a ByteDance social role onto the official detail URL", () => {
  const payload = JSON.parse(readFileSync("fixtures/cn/bytedance.sample.json", "utf8")) as {
    data: { job_post_list: unknown[] };
  };
  const jobs = normalizeByteDancePosts(payload.data.job_post_list);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].category, "硬件");
  assert.deepEqual(jobs[0].locations, ["北京", "上海"]);
  assert.equal(
    jobs[0].officialUrl,
    "https://jobs.bytedance.com/experienced/position/sample-bytedance-chip/detail",
  );
  assert.match(jobs[0].descriptionText ?? "", /晶圆工艺/);
});

test("normalizes a Meituan social role onto the official detail URL", () => {
  const payload = JSON.parse(readFileSync("fixtures/cn/meituan.sample.json", "utf8")) as {
    data: { list: unknown[] };
  };
  const jobs = normalizeMeituanJobs(payload.data.list);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, "品类营销运营");
  assert.equal(jobs[0].locations[0], "北京市");
  assert.match(jobs[0].officialUrl, /^https:\/\/zhaopin\.meituan\.com\/web\/position\/detail\?jobUnionId=sample-meituan-ops/);
  assert.match(jobs[0].descriptionHtml ?? "", /职位要求/);
});

test("refuses a page that has roles but no Chinese requirements", () => {
  assert.throws(() =>
    normalizeMeituanJobs([
      {
        jobUnionId: "en",
        name: "English role",
        jobRequirement: "Fluent English only.",
        cityList: [{ name: "Beijing" }],
      },
    ]),
  );
});
