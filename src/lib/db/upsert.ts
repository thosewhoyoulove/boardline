import type { NormalizedJob } from "@/lib/crawlers/types";
import { getPrisma } from "@/lib/db/client";
import { positiveInteger } from "@/lib/crawlers/settings";

export async function upsertNormalizedJobs(input: {
  companyId: string;
  sourceId: string;
  jobs: NormalizedJob[];
  authoritative: boolean;
}): Promise<{ upserted: number; deactivated: number }> {
  const prisma = getPrisma();
  const now = new Date();
  const graceHours = positiveInteger(process.env.SCRAPE_DEACTIVATE_AFTER_HOURS, 48, 1, 720);
  const staleBefore = new Date(now.getTime() - graceHours * 60 * 60 * 1000);

  return prisma.$transaction(
    async (tx) => {
      const previous = await tx.job.findMany({
        where: { sourceId: input.sourceId },
        select: { uniqueKey: true, contentHash: true },
      });
      const hashes = new Map(previous.map((job) => [job.uniqueKey, job.contentHash]));
      for (const job of input.jobs) {
        await tx.job.upsert({
          where: { uniqueKey: job.uniqueKey },
          create: {
            companyId: input.companyId,
            sourceId: input.sourceId,
            uniqueKey: job.uniqueKey,
            title: job.title,
            category: job.category,
            locations: job.locations,
            descriptionHtml: job.descriptionHtml,
            descriptionText: job.descriptionText,
            officialUrl: job.officialUrl,
            publishTime: job.publishTime,
            firstSeenAt: now,
            lastSeenAt: now,
            isActive: true,
            contentHash: job.contentHash,
          },
          update: hashes.get(job.uniqueKey) === job.contentHash ? {
            lastSeenAt: now,
            isActive: true,
            publishTime: job.publishTime,
          } : {
            title: job.title,
            category: job.category,
            locations: job.locations,
            descriptionHtml: job.descriptionHtml,
            descriptionText: job.descriptionText,
            officialUrl: job.officialUrl,
            publishTime: job.publishTime,
            lastSeenAt: now,
            isActive: true,
            contentHash: job.contentHash,
          },
        });
      }

      // Empty results are deliberately non-destructive, even if an API says zero.
      if (!input.authoritative || input.jobs.length === 0) {
        return { upserted: input.jobs.length, deactivated: 0 };
      }

      const deactivated = await tx.job.updateMany({
        where: {
          sourceId: input.sourceId,
          isActive: true,
          lastSeenAt: { lt: staleBefore },
        },
        data: { isActive: false },
      });

      return { upserted: input.jobs.length, deactivated: deactivated.count };
    },
    { timeout: 60_000 },
  );
}
