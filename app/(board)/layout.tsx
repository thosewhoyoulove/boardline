import { JobFilters } from "@/components/job-filters";
import { getPrisma } from "@/lib/db/client";
import Link from "next/link";
import { CompanyShortcut } from "@/components/company-shortcut";

async function loadFilterCompanies() {
  "use cache";
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
        <div className="employer-shortcuts">
          <div className="employer-heading"><h2>从感兴趣的公司开始</h2><Link href="/companies">查看公司目录</Link></div>
          <div className="employer-grid">
            {companies.map((company) => (
              <CompanyShortcut key={company.slug} slug={company.slug} name={company.displayName} />
            ))}
          </div>
        </div>
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
