import type { RecruitmentType } from "@/lib/crawlers/types";

export type DemoCompany = {
  slug: string;
  displayName: string;
  referralUrl: string;
  recruitmentType: RecruitmentType;
  boardSlug: string;
};

/** Public Ashby boards. The posting API does not require authentication. */
export const demoCompanies: DemoCompany[] = [
  {
    slug: "linear",
    displayName: "Linear",
    referralUrl: "https://jobs.ashbyhq.com/linear",
    recruitmentType: "social",
    boardSlug: "linear",
  },
  {
    slug: "notion",
    displayName: "Notion",
    referralUrl: "https://jobs.ashbyhq.com/notion",
    recruitmentType: "social",
    boardSlug: "notion",
  },
  {
    slug: "ashby",
    displayName: "Ashby",
    referralUrl: "https://jobs.ashbyhq.com/ashby",
    recruitmentType: "social",
    boardSlug: "ashby",
  },
];
