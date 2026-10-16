import { demoCompanies, retiredDemoSlugs } from "@/lib/db/demo-companies";
import { getPrisma } from "@/lib/db/client";

export async function ensureDemoCompanies(): Promise<{ companies: number; sourcesCreated: number }> {
  const prisma = getPrisma();
  let sourcesCreated = 0;

  if (retiredDemoSlugs.length > 0) {
    await prisma.company.updateMany({
      where: { slug: { in: [...retiredDemoSlugs] } },
      data: { active: false },
    });
    await prisma.dataSource.updateMany({
      where: { company: { slug: { in: [...retiredDemoSlugs] } } },
      data: { isActive: false },
    });
  }

  for (const demo of demoCompanies) {
    const company = await prisma.company.upsert({
      where: { slug: demo.slug },
      create: {
        slug: demo.slug,
        displayName: demo.displayName,
        referralUrl: demo.referralUrl,
        active: true,
      },
      update: {
        displayName: demo.displayName,
        referralUrl: demo.referralUrl,
      },
    });

    const existing = await prisma.dataSource.findFirst({
      where: { companyId: company.id, sourceType: demo.sourceType },
      select: { id: true },
    });

    if (!existing) {
      await prisma.dataSource.create({
        data: {
          companyId: company.id,
          sourceType: demo.sourceType,
          recruitmentType: demo.recruitmentType,
          config: demo.config,
          isActive: true,
        },
      });
      sourcesCreated += 1;
    }
  }

  return { companies: demoCompanies.length, sourcesCreated };
}
