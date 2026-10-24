/** Official, reviewed career portals. No arbitrary URLs or guessed company identities. */
export const employerCatalog = [
  { slug: "netease", displayName: "网易", sourceType: "netease_api", careerUrl: "https://hr.163.com/job-list.html", detailPrefix: "https://hr.163.com/job-detail.html?id=" },
  { slug: "bilibili", displayName: "哔哩哔哩", sourceType: "bilibili_api", careerUrl: "https://jobs.bilibili.com/social/positions", detailPrefix: "https://jobs.bilibili.com/social/positions/" },
] as const;
