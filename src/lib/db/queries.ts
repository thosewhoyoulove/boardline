import "server-only";

import { isFrontendRole } from "@/lib/crawlers/text";
import { getPrisma } from "@/lib/db/client";

export type JobListItem = {
  id: string;
  title: string;
  category: string | null;
  locations: string[];
  descriptionText: string | null;
  publishTime: string | null;
  firstSeenAt: string;
  companySlug: string;
  companyName: string;
};

export type JobDetail = Omit<JobListItem, "publishTime" | "firstSeenAt"> & {
  descriptionHtml: string | null;
  officialUrl: string;
  publishTime: Date | null;
  firstSeenAt: Date;
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

export type PublishedBoard = {
  jobs: JobListItem[];
  companies: CompanyOption[];
};

export function readLocations(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export async function getPublishedBoard(): Promise<PublishedBoard> {
  "use cache";
  const prisma = getPrisma();
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

  return {
    jobs: rows
      .filter((job) => isFrontendRole(job.title))
      .map((job) => ({
        id: job.id,
        title: job.title,
        category: job.category,
        locations: readLocations(job.locations),
        descriptionText: job.descriptionText,
        publishTime: job.publishTime?.toISOString() ?? null,
        firstSeenAt: job.firstSeenAt.toISOString(),
        companySlug: job.company.slug,
        companyName: job.company.displayName,
      })),
    companies,
  };
}

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

export async function getCompanyDirectory(): Promise<CompanyCard[]> {
  "use cache";
  const companies = await getPrisma().company.findMany({
    where: { active: true },
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
}
