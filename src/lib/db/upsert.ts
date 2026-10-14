import type { NormalizedJob } from "@/lib/crawlers/types";
import { getPrisma } from "@/lib/db/client";

export async function upsertNormalizedJobs(input: {
  companyId: string;
  sourceId: string;
  jobs: NormalizedJob[];
  authoritative: boolean;
}): Promise<{ upserted: number; deactivated: number }> {
  const prisma = getPrisma();
  const now = new Date();
  const keys = input.jobs.map((job) => job.uniqueKey);

  return prisma.$transaction(
    async (tx) => {
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
          update: {
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

      if (!input.authoritative) {
        return { upserted: input.jobs.length, deactivated: 0 };
      }

      const deactivated = await tx.job.updateMany({
        where: {
          sourceId: input.sourceId,
          isActive: true,
          ...(keys.length > 0 ? { uniqueKey: { notIn: keys } } : {}),
        },
        data: { isActive: false },
      });

      return { upserted: input.jobs.length, deactivated: deactivated.count };
    },
    { timeout: 60_000 },
  );
}
