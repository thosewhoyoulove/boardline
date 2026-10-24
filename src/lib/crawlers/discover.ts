import { employerCatalog } from "@/lib/crawlers/employer-catalog";
import { withScrapeLease } from "@/lib/crawlers/lease";
import { getAdapter } from "@/lib/crawlers/registry";
import { fetchResponse } from "@/lib/crawlers/public-json";
import { getPrisma } from "@/lib/db/client";

export function validateDiscoveredJobs(jobs: Array<{uniqueKey: string; officialUrl: string; descriptionText: string | null}>, detailPrefix: string): void {
  const keys = new Set<string>();
  for (const job of jobs) {
    const url = new URL(job.officialUrl);
    if (!job.officialUrl.startsWith(detailPrefix) || job.officialUrl.length <= detailPrefix.length || url.username || url.password) throw new Error("职位链接不属于审核过的官方详情页");
    if (!job.descriptionText?.trim() || keys.has(job.uniqueKey)) throw new Error("职位内容为空或唯一标识重复");
    keys.add(job.uniqueKey);
  }
}

export async function discoverEmployers({dryRun = false} = {}) {
  return withScrapeLease(async assertHeld => {
    const prisma = getPrisma();
    const results: Array<{company: string; status: string; jobs: number; note?: string}> = [];
    for (const candidate of employerCatalog) {
      try {
        const existing = await prisma.company.findUnique({where: {slug: candidate.slug}, include: {sources: true}});
        if (existing && (!existing.active || existing.sources.some(source => source.sourceType === candidate.sourceType))) {
          results.push({company: candidate.displayName, status: "skipped", jobs: 0, note: "已接入，交由常规抓取更新；手动停用的公司保持停用"});
          continue;
        }
        const adapter = getAdapter(candidate.sourceType);
        if (!adapter) throw new Error(`缺少适配器 ${candidate.sourceType}`);
        const fetched = await adapter.fetchJobs({config: {pageSize: 20}, offline: false});
        if (!fetched.authoritative) throw new Error(`扫描不完整，本次不接入：${fetched.note ?? ""}`);
        if (!fetched.jobs.length) {
          results.push({company: candidate.displayName, status: "empty", jobs: 0, note: "暂无符合条件的岗位，下次继续检查"});
          continue;
        }
        validateDiscoveredJobs(fetched.jobs, candidate.detailPrefix);
        // Check that an official job URL hasn't become a redirect to a portal/login page.
        const expected = new URL(fetched.jobs[0].officialUrl);
        const response = await fetchResponse(expected.href, {headers: {accept: "text/html"}});
        const actual = new URL(response.url);
        await response.body?.cancel();
        if (actual.origin !== expected.origin || actual.pathname !== expected.pathname || (candidate.slug === "netease" && actual.searchParams.get("id") !== expected.searchParams.get("id"))) throw new Error("官方详情页跳转到其他页面，本次不接入");
        await assertHeld();
        if (!dryRun) {
          // Atomic registration: never expose an empty company if importing jobs fails.
          await prisma.$transaction(async tx => {
            const company = existing ?? await tx.company.create({data: {slug: candidate.slug, displayName: candidate.displayName, referralUrl: candidate.careerUrl, active: true}});
            const source = await tx.dataSource.create({data: {companyId: company.id, sourceType: candidate.sourceType, recruitmentType: "social", config: {pageSize: 20}, isActive: true}});
            const now = new Date();
            for (const job of fetched.jobs) {
              const {externalId: _externalId, ...data} = job;
              void _externalId;
              await tx.job.upsert({where: {uniqueKey: job.uniqueKey}, create: {...data, companyId: company.id, sourceId: source.id, firstSeenAt: now, lastSeenAt: now, isActive: true}, update: {lastSeenAt: now, isActive: true}});
            }
          }, {timeout: 60_000});
        }
        results.push({company: candidate.displayName, status: dryRun ? "ready" : "added", jobs: fetched.jobs.length});
      } catch (error) {
        results.push({company: candidate.displayName, status: "failed", jobs: 0, note: error instanceof Error ? error.message : String(error)});
      }
    }
    return {checkedAt: new Date().toISOString(), dryRun, ok: results.every(result => result.status !== "failed"), results};
  });
}
