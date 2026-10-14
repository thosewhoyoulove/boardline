import { Suspense } from "react";

import { BoardFrame } from "@/components/job-filters";
import { FilterBarFallback, JobListSkeleton } from "@/components/job-skeletons";
import { getPrisma } from "@/lib/db/client";

async function loadFilterCompanies() {
  "use cache";
  return getPrisma().company.findMany({
    where: { active: true },
    orderBy: { displayName: "asc" },
    select: { slug: true, displayName: true },
  });
}

async function FilterSlot({ children }: { children: React.ReactNode }) {
  const companies = await loadFilterCompanies();
  return <BoardFrame companies={companies}>{children}</BoardFrame>;
}

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-16 sm:px-6 sm:pt-10">
      <header className="mb-8 max-w-2xl">
        <p className="text-xs tracking-[0.18em] text-primary uppercase">公开职位板</p>
        <h1 className="mt-2 font-display text-4xl leading-tight tracking-tight sm:text-5xl">正在公开招聘的前端职位</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          只收录中国大陆公司的社会招聘，岗位限于前端和 AI 前端，职位要求为中文。申请按钮只指向官方页面。
        </p>
      </header>
      <Suspense
        fallback={
          <div>
            <FilterBarFallback />
            <div className="mt-6">
              <JobListSkeleton />
            </div>
          </div>
        }
      >
        <FilterSlot>{children}</FilterSlot>
      </Suspense>
    </div>
  );
}
