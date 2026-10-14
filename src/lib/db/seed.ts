import { demoCompanies } from "@/lib/db/demo-companies";
import { getPrisma } from "@/lib/db/client";

export async function ensureDemoCompanies(): Promise<{ companies: number; sourcesCreated: number }> {
  const prisma = getPrisma();
  let sourcesCreated = 0;

  for (const demo of demoCompanies) {
    const company = await prisma.company.upsert({
      where: { slug: demo.slug },
      create: {
        slug: demo.slug,
        displayName: demo.displayName,
        referralUrl: demo.referralUrl,
        active: true,
      },
      update: {},
    });

    const existing = await prisma.dataSource.findFirst({
      where: { companyId: company.id, sourceType: "ashby_api" },
      select: { id: true },
    });

    if (!existing) {
      await prisma.dataSource.create({
        data: {
          companyId: company.id,
          sourceType: "ashby_api",
          recruitmentType: demo.recruitmentType,
          config: { boardSlug: demo.boardSlug },
          isActive: true,
        },
      });
      sourcesCreated += 1;
    }
  }

  return { companies: demoCompanies.length, sourcesCreated };
}
