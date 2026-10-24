import type { RecruitmentType } from "@/lib/crawlers/types";

export type DemoCompany = {
  slug: string;
  displayName: string;
  referralUrl: string;
  recruitmentType: RecruitmentType;
  sourceType: string;
  config: { pageSize: number; maxPages?: number };
};

/** Earlier demo boards. Kept in the database but no longer scraped. */
export const retiredDemoSlugs = ["linear", "notion", "ashby"] as const;

/**
 * Mainland employers with a public, unauthenticated social-hire API.
 * Each source searches for frontend roles and then keeps only 前端 / AI 前端 titles.
 * Tencent needs one detail request per row, so its page is smaller.
 */
export const demoCompanies: DemoCompany[] = [
  {
    slug: "tencent",
    displayName: "腾讯",
    referralUrl: "https://careers.tencent.com/search.html",
    recruitmentType: "social",
    sourceType: "tencent_api",
    config: { pageSize: 20 },
  },
  {
    slug: "bytedance",
    displayName: "字节跳动",
    referralUrl: "https://jobs.bytedance.com/experienced/position",
    recruitmentType: "social",
    sourceType: "bytedance_api",
    config: { pageSize: 30 },
  },
  {
    slug: "alibaba",
    displayName: "阿里巴巴",
    referralUrl: "https://talent.alibaba.com/off-campus/position-list?lang=zh",
    recruitmentType: "social",
    sourceType: "alibaba_api",
    config: { pageSize: 30 },
  },
  {
    slug: "meituan",
    displayName: "美团",
    referralUrl: "https://zhaopin.meituan.com/web/social",
    recruitmentType: "social",
    sourceType: "meituan_api",
    config: { pageSize: 30 },
  },
  {
    slug: "jd",
    displayName: "京东",
    referralUrl: "https://zhaopin.jd.com/web/job/job_info_list/3",
    recruitmentType: "social",
    sourceType: "jd_api",
    config: { pageSize: 30 },
  },
  {
    slug: "xiaomi",
    displayName: "小米",
    referralUrl: "https://xiaomi.jobs.f.mioffice.cn/index",
    recruitmentType: "social",
    sourceType: "xiaomi_api",
    config: { pageSize: 30 },
  },
  {
    slug: "didi",
    displayName: "滴滴",
    referralUrl: "https://talent.didiglobal.com/social/list",
    recruitmentType: "social",
    sourceType: "didi_api",
    config: { pageSize: 30 },
  },
  {
    slug: "ctrip",
    displayName: "携程",
    referralUrl: "https://job.ctrip.com/experienced/jobList",
    recruitmentType: "social",
    sourceType: "ctrip_api",
    config: { pageSize: 30 },
  },
  {
    slug: "baidu",
    displayName: "百度",
    referralUrl: "https://talent.baidu.com/jobs/social-list",
    recruitmentType: "social",
    sourceType: "baidu_api",
    config: { pageSize: 30 },
  },
  {
    slug: "netease",
    displayName: "网易",
    referralUrl: "https://hr.163.com/job-list.html",
    recruitmentType: "social",
    sourceType: "netease_api",
    config: { pageSize: 30 },
  },
  {
    slug: "xiaohongshu",
    displayName: "小红书",
    referralUrl: "https://job.xiaohongshu.com/social/position",
    recruitmentType: "social",
    sourceType: "xiaohongshu_api",
    config: { pageSize: 30 },
  },
  {
    slug: "huawei",
    displayName: "华为",
    referralUrl: "https://career.huawei.com/cn/social-recruitment-job-list",
    recruitmentType: "social",
    sourceType: "huawei_api",
    config: { pageSize: 40, maxPages: 40 },
  },
  {
    slug: "bilibili",
    displayName: "哔哩哔哩",
    referralUrl: "https://jobs.bilibili.com/social/positions?isTrusted=true",
    recruitmentType: "social",
    sourceType: "bilibili_api",
    config: { pageSize: 30 },
  },
];
