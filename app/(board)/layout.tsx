import { CompanyFilter } from "@/components/company-filter";
import { JobFilters } from "@/components/job-filters";
import { cacheLife, cacheTag } from "next/cache";
import { PUBLISHED_JOBS_CACHE_TAG } from "@/lib/db/cache-tags";
import { getPrisma } from "@/lib/db/client";

async function loadFilterCompanies() {
  "use cache";
  cacheTag(PUBLISHED_JOBS_CACHE_TAG);
  cacheLife({ stale: 60, revalidate: 60, expire: 300 });
  return getPrisma().company.findMany({
    where: { active: true },
    orderBy: { displayName: "asc" },
    select: { slug: true, displayName: true },
  });
}

export default async function BoardLayout({ children }: { children: React.ReactNode }) {
  const companies = await loadFilterCompanies();
  return (
    <div className="board-shell">
      <header className="board-intro">
        <div>
          <h1>下一份前端工作，<br />从这里开始。</h1>
          <p className="intro-description">汇集国内公司公开的前端与 AI 前端社招。<br className="hidden sm:block" />找到合适的职位，直接前往官方申请。</p>
          <div className="intro-note"><span aria-hidden="true" />公开来源，官方直达</div>
        </div>
        <CompanyFilter companies={companies} variant="hero" />
      </header>
      <div className="board-workspace">
        <aside className="filter-rail" aria-label="筛选职位"><JobFilters companies={companies} />
          <p className="filter-footnote">每 6 小时检查官方招聘来源。<br />职位信息及申请以招聘方官网为准。</p>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
