import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeAlibabaPosts } from "@/lib/crawlers/alibaba_api";
import { normalizeByteDancePosts } from "@/lib/crawlers/bytedance_api";
import { normalizeCtripJobs } from "@/lib/crawlers/ctrip_api";
import { normalizeDidiJobs } from "@/lib/crawlers/didi_api";
import { normalizeJdJobs } from "@/lib/crawlers/jd_api";
import { normalizeMeituanJobs } from "@/lib/crawlers/meituan_api";
import { normalizeTencentPosts } from "@/lib/crawlers/tencent_api";
import { normalizeXiaomiPosts } from "@/lib/crawlers/xiaomi_api";
import { isFrontendRole } from "@/lib/crawlers/text";

test("keeps Tencent frontend roles and drops other titles", () => {
  const payload = JSON.parse(readFileSync("fixtures/cn/tencent.sample.json", "utf8")) as { posts: unknown[] };
  const jobs = normalizeTencentPosts(payload.posts);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, "前端开发工程师");
  assert.equal(jobs[0].locations[0], "深圳");
  assert.equal(jobs[0].officialUrl, "https://careers.tencent.com/jobdesc.html?postId=sample-tencent-design");
  assert.match(jobs[0].descriptionHtml ?? "", /职位要求/);
  assert.match(jobs[0].descriptionText ?? "", /中文需求文档/);
  assert.equal(jobs[0].descriptionHtml?.includes("<script"), false);
});

test("normalizes a ByteDance AI frontend role and drops hardware", () => {
  const payload = JSON.parse(readFileSync("fixtures/cn/bytedance.sample.json", "utf8")) as {
    data: { job_post_list: unknown[] };
  };
  const jobs = normalizeByteDancePosts(payload.data.job_post_list);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, "AI前端开发工程师");
  assert.equal(jobs[0].category, "前端");
  assert.deepEqual(jobs[0].locations, ["北京", "上海"]);
  assert.equal(jobs[0].officialUrl, "https://jobs.bytedance.com/experienced/position/sample-bytedance-fe/detail");
  assert.match(jobs[0].descriptionText ?? "", /TypeScript/);
});

test("normalizes a Meituan frontend role and drops operations", () => {
  const payload = JSON.parse(readFileSync("fixtures/cn/meituan.sample.json", "utf8")) as {
    data: { list: unknown[] };
  };
  const jobs = normalizeMeituanJobs(payload.data.list);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, "前端开发工程师");
  assert.equal(jobs[0].locations[0], "北京市");
  assert.match(jobs[0].officialUrl, /^https:\/\/zhaopin\.meituan\.com\/web\/position\/detail\?jobUnionId=sample-meituan-fe/);
  assert.match(jobs[0].descriptionHtml ?? "", /职位要求/);
});

test("keeps Xiaomi, Alibaba, Didi and JD frontend roles on official pages", () => {
  const xiaomi = JSON.parse(readFileSync("fixtures/cn/xiaomi.sample.json", "utf8")) as {
    data: { job_post_list: unknown[] };
  };
  const alibaba = JSON.parse(readFileSync("fixtures/cn/alibaba.sample.json", "utf8")) as {
    content: { datas: unknown[] };
  };
  const didi = JSON.parse(readFileSync("fixtures/cn/didi.sample.json", "utf8")) as { data: { items: unknown[] } };
  const jd = JSON.parse(readFileSync("fixtures/cn/jd.sample.json", "utf8")) as { jobs: unknown[] };

  const xiaomiJobs = normalizeXiaomiPosts(xiaomi.data.job_post_list);
  assert.equal(xiaomiJobs.length, 1);
  assert.equal(xiaomiJobs[0].officialUrl, "https://xiaomi.jobs.f.mioffice.cn/index/position/sample-xiaomi-fe/detail");

  const alibabaJobs = normalizeAlibabaPosts(alibaba.content.datas);
  assert.equal(alibabaJobs.length, 1);
  assert.match(alibabaJobs[0].officialUrl, /positionId=100024655002/);

  const didiJobs = normalizeDidiJobs(didi.data.items);
  assert.equal(didiJobs.length, 1);
  assert.equal(didiJobs[0].officialUrl, "https://talent.didiglobal.com/social/jobDetail?jdId=66767");

  const jdJobs = normalizeJdJobs(jd.jobs);
  assert.equal(jdJobs.length, 1);
  assert.equal(jdJobs[0].title, "前端开发工程师");
  assert.equal(jdJobs[0].officialUrl, "https://zhaopin.jd.com/web/job/job_info_list/3");
});

test("keeps Ctrip social frontend roles and strips requirement HTML", () => {
  const payload = JSON.parse(readFileSync("fixtures/cn/ctrip.sample.json", "utf8")) as {
    retValue: { recruitJobAdList: unknown[] };
  };
  const jobs = normalizeCtripJobs(payload.retValue.recruitJobAdList);

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, "高级前端开发工程师");
  assert.equal(jobs[0].officialUrl, "https://job.ctrip.com/job-detail/sample-ctrip-fe");
  assert.equal(jobs[0].descriptionText?.includes("<p>"), false);
  assert.match(jobs[0].descriptionText ?? "", /中文需求/);
});

test("refuses a frontend role whose requirements are not Chinese", () => {
  assert.throws(() =>
    normalizeMeituanJobs([
      {
        jobUnionId: "en",
        name: "前端开发工程师",
        jobRequirement: "Fluent English only.",
        cityList: [{ name: "Beijing" }],
      },
    ]),
  );
});

test("accepts frontend and AI frontend titles only", () => {
  assert.equal(isFrontendRole("前端开发工程师"), true);
  assert.equal(isFrontendRole("AI前端工程师"), true);
  assert.equal(isFrontendRole("高级前端开发工程师（AI方向）"), true);
  assert.equal(isFrontendRole("Frontend Engineer"), true);
  assert.equal(isFrontendRole("前端产品经理"), false);
  assert.equal(isFrontendRole("AI应用工程师（偏前端）"), false);
  assert.equal(isFrontendRole("全栈开发工程师"), false);
  assert.equal(isFrontendRole("前端开发工程师（2027届秋招）"), false);
  assert.equal(isFrontendRole("后端开发工程师"), false);
  assert.equal(isFrontendRole("客户端开发工程师"), false);
});
