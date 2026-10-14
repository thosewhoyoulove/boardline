import "server-only";
import { cache } from "react";
import { connection } from "next/server";

import { isFrontendRole } from "@/lib/crawlers/text";
import { getPrisma } from "@/lib/db/client";

export type JobFilters = {
  q: string;
  company: string;
  location: string;
  page: number;
};

export type JobListItem = {
  id: string;
  title: string;
  category: string | null;
  locations: string[];
  publishTime: Date | null;
  firstSeenAt: Date;
  companySlug: string;
  companyName: string;
};

export type JobDetail = JobListItem & {
  descriptionHtml: string | null;
  descriptionText: string | null;
  officialUrl: string;
  lastSeenAt: Date;
  isActive: boolean;
  recruitmentType: string;
  sourceType: string;
  referralUrl: string | null;
};

export type CompanyOption = {
  slug: string;
  displayName: string;
};

export type CompanyCard = CompanyOption & {
  referralUrl: string | null;
  active: boolean;
  openJobs: number;
  sources: Array<{ sourceType: string; recruitmentType: string }>;
};

export type JobBoardData = {
  jobs: JobListItem[];
  total: number;
  page: number;
  pageSize: number;
  unfilteredTotal: number;
  companies: CompanyOption[];
};

export const PAGE_SIZE = 20;

export function readLocations(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function includesNeedle(haystack: string, needle: string): boolean {
  return haystack.toLocaleLowerCase().includes(needle.toLocaleLowerCase());
}

export const getJobBoard = cache(async (filters: JobFilters): Promise<JobBoardData> => {
  await connection();
  const prisma = getPrisma();
  const companySlug = filters.company || undefined;

  const [rows, companies] = await Promise.all([
    prisma.job.findMany({
      where: {
        isActive: true,
        company: { active: true },
      },
      orderBy: [{ publishTime: "desc" }, { firstSeenAt: "desc" }],
      select: {
        id: true,
        title: true,
        category: true,
        locations: true,
        descriptionText: true,
        publishTime: true,
        firstSeenAt: true,
        company: { select: { slug: true, displayName: true } },
      },
    }),
    prisma.company.findMany({
      where: { active: true },
      orderBy: { displayName: "asc" },
      select: { slug: true, displayName: true },
    }),
  ]);

  const frontendRows = rows.filter((job) => isFrontendRole(job.title));
  const matched = frontendRows.filter((job) => {
    if (companySlug && job.company.slug !== companySlug) return false;
    const locations = readLocations(job.locations);
    if (filters.location && !locations.some((location) => includesNeedle(location, filters.location))) {
      return false;
    }
    if (!filters.q) return true;
    const haystack = [job.title, job.category, job.company.displayName, locations.join(" "), job.descriptionText]
      .filter((part): part is string => Boolean(part))
      .join("\n");
    return includesNeedle(haystack, filters.q);
  });

  const pageCount = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const start = (page - 1) * PAGE_SIZE;

  return {
    jobs: matched.slice(start, start + PAGE_SIZE).map((job) => ({
      id: job.id,
      title: job.title,
      category: job.category,
      locations: readLocations(job.locations),
      publishTime: job.publishTime,
      firstSeenAt: job.firstSeenAt,
      companySlug: job.company.slug,
      companyName: job.company.displayName,
    })),
    total: matched.length,
    page,
    pageSize: PAGE_SIZE,
    unfilteredTotal: frontendRows.length,
    companies,
  };
});

export async function listStaticJobIds(): Promise<string[]> {
  const jobs = await getPrisma().job.findMany({
    where: { isActive: true, company: { active: true } },
    select: { id: true, title: true },
  });
  return jobs.filter((job) => isFrontendRole(job.title)).map((job) => job.id);
}

// Cached at build time so each known job is a complete page, not a Vercel partial shell.
export async function getJobDetail(id: string): Promise<JobDetail | null> {
  "use cache";
  const job = await getPrisma().job.findUnique({
    where: { id },
    include: {
      company: true,
      source: true,
    },
  });
  if (!job || !isFrontendRole(job.title)) return null;

  return {
    id: job.id,
    title: job.title,
    category: job.category,
    locations: readLocations(job.locations),
    publishTime: job.publishTime,
    firstSeenAt: job.firstSeenAt,
    lastSeenAt: job.lastSeenAt,
    companySlug: job.company.slug,
    companyName: job.company.displayName,
    descriptionHtml: job.descriptionHtml,
    descriptionText: job.descriptionText,
    officialUrl: job.officialUrl,
    isActive: job.isActive && job.company.active,
    recruitmentType: job.source.recruitmentType,
    sourceType: job.source.sourceType,
    referralUrl: job.company.referralUrl,
  };
}

export const getCompanyDirectory = cache(async (): Promise<CompanyCard[]> => {
  await connection();
  const companies = await getPrisma().company.findMany({
    orderBy: { displayName: "asc" },
    include: {
      sources: {
        where: { isActive: true },
        select: { sourceType: true, recruitmentType: true },
      },
      jobs: {
        where: { isActive: true },
        select: { title: true },
      },
    },
  });

  return companies.map((company) => ({
    slug: company.slug,
    displayName: company.displayName,
    referralUrl: company.referralUrl,
    active: company.active,
    openJobs: company.jobs.filter((job) => isFrontendRole(job.title)).length,
    sources: company.sources,
  }));
});
