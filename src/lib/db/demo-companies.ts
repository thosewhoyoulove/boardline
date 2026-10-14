import type { RecruitmentType } from "@/lib/crawlers/types";

export type DemoCompany = {
  slug: string;
  displayName: string;
  referralUrl: string;
  recruitmentType: RecruitmentType;
  sourceType: string;
  config: { pageSize: number };
};

/** Earlier demo boards. Kept in the database but no longer scraped. */
export const retiredDemoSlugs = ["linear", "notion", "ashby"] as const;

/**
 * Mainland China employers with a public, unauthenticated career JSON API.
 * Each source keeps the latest page of social-hire roles whose requirements are in Chinese.
 */
export const demoCompanies: DemoCompany[] = [
  {
    slug: "tencent",
    displayName: "腾讯",
    referralUrl: "https://careers.tencent.com/search.html",
    recruitmentType: "social",
    sourceType: "tencent_api",
    config: { pageSize: 24 },
  },
  {
    slug: "bytedance",
    displayName: "字节跳动",
    referralUrl: "https://jobs.bytedance.com/experienced/position",
    recruitmentType: "social",
    sourceType: "bytedance_api",
    config: { pageSize: 24 },
  },
  {
    slug: "meituan",
    displayName: "美团",
    referralUrl: "https://zhaopin.meituan.com/web/social",
    recruitmentType: "social",
    sourceType: "meituan_api",
    config: { pageSize: 24 },
  },
];
