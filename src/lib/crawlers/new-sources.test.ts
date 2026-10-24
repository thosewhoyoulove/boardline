import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeBaiduPosts } from "@/lib/crawlers/baidu_api";
import { normalizeBilibiliJobs } from "@/lib/crawlers/bilibili_api";
import { normalizeHuaweiJobs } from "@/lib/crawlers/huawei_api";
import { normalizeNeteaseJobs } from "@/lib/crawlers/netease_api";
import { normalizeXiaohongshuJobs } from "@/lib/crawlers/xiaohongshu_api";
import { pageTotal } from "@/lib/crawlers/pagination";

test("normalizes Baidu, NetEase and Xiaohongshu social frontend roles", () => {
  const baidu = JSON.parse(readFileSync("fixtures/cn/baidu.sample.json", "utf8")) as { data: { list: unknown[] } };
  const netease = JSON.parse(readFileSync("fixtures/cn/netease.sample.json", "utf8")) as { data: { list: unknown[] } };
  const xiaohongshu = JSON.parse(readFileSync("fixtures/cn/xiaohongshu.sample.json", "utf8")) as { data: { list: unknown[] } };

  const baiduJobs = normalizeBaiduPosts(baidu.data.list);
  assert.equal(baiduJobs.length, 1);
  assert.equal(baiduJobs[0].title, "前端开发工程师");
  assert.equal(baiduJobs[0].officialUrl, "https://talent.baidu.com/jobs/detail/SOCIAL/sample-baidu-fe");
  assert.match(baiduJobs[0].descriptionText ?? "", /中文技术方案/);

  const neteaseJobs = normalizeNeteaseJobs(netease.data.list);
  assert.equal(neteaseJobs.length, 1);
  assert.deepEqual(neteaseJobs[0].locations, ["杭州市", "上海市"]);
  assert.equal(neteaseJobs[0].officialUrl, "https://hr.163.com/job-detail.html?id=88001&lang=zh");

  const xiaohongshuJobs = normalizeXiaohongshuJobs(xiaohongshu.data.list);
  assert.equal(xiaohongshuJobs.length, 1);
  assert.deepEqual(xiaohongshuJobs[0].locations, ["上海市", "北京市"]);
  assert.equal(xiaohongshuJobs[0].officialUrl, "https://job.xiaohongshu.com/social/position?positionId=18140");
});

test("keeps mainland Huawei and Bilibili frontend roles on official pages", () => {
  const huawei = JSON.parse(readFileSync("fixtures/cn/huawei.sample.json", "utf8")) as { data: { result: unknown[] } };
  const bilibili = JSON.parse(readFileSync("fixtures/cn/bilibili.sample.json", "utf8")) as { data: { list: unknown[] } };

  const huaweiJobs = normalizeHuaweiJobs(huawei.data.result);
  assert.equal(huaweiJobs.length, 1);
  assert.equal(huaweiJobs[0].locations[0], "深圳");
  assert.equal(huaweiJobs[0].officialUrl, "https://career.huawei.com/cn/social-recruitment-job-list?jobId=114001");
  assert.match(huaweiJobs[0].descriptionText ?? "", /中文完成设计评审/);

  const bilibiliJobs = normalizeBilibiliJobs(bilibili.data.list);
  assert.equal(bilibiliJobs.length, 1);
  assert.equal(bilibiliJobs[0].title, "资深前端工程师");
  assert.equal(bilibiliJobs[0].locations[0], "上海");
  assert.equal(bilibiliJobs[0].officialUrl, "https://jobs.bilibili.com/social/positions/25021?isTrusted=true");
  assert.match(bilibiliJobs[0].descriptionText ?? "", /中文技术方案/);
  assert.match(bilibiliJobs[0].descriptionHtml ?? "", /职位职责/);
  assert.equal(bilibiliJobs[0].descriptionHtml?.includes("<script"), false);
});

test("accepts numeric strings as page totals", () => {
  assert.equal(pageTotal("98"), 98);
  assert.equal(pageTotal("98.5"), undefined);
  assert.equal(pageTotal(""), undefined);
});
