"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { JobListSkeleton } from "@/components/job-skeletons";
import { JobPagination } from "@/components/job-pagination";
import { Badge } from "@/components/ui/badge";
import {
  BOARD_QUERY_EVENT,
  emptyBoardQuery,
  filterJobs,
  PAGE_SIZE,
  readBoardQuery,
  writeBoardQuery,
  type BoardQuery,
} from "@/lib/board-query";
import type { CompanyOption, JobListItem } from "@/lib/db/queries";
import { formatDate, formatLocations, formatUpdateTime, isFresh } from "@/lib/format";

export function JobBoard({ jobs, companies, lastUpdatedAt }: {
  jobs: JobListItem[];
  companies: CompanyOption[];
  lastUpdatedAt: string | null;
}) {
  const [query, setQuery] = useState<BoardQuery>(emptyBoardQuery);
  const [urlReady, setUrlReady] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    function apply() {
      setQuery(readBoardQuery());
      setUrlReady(true);
      setNow(Date.now());
    }
    const timer = window.setTimeout(apply, 0);
    window.addEventListener("popstate", apply);
    window.addEventListener(BOARD_QUERY_EVENT, apply);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("popstate", apply);
      window.removeEventListener(BOARD_QUERY_EVENT, apply);
    };
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    document.getElementById("board-pending-style")?.remove();
  }, [urlReady]);

  if (jobs.length === 0) return <ScrapeHint />;

  const matched = filterJobs(jobs, query);
  const selectedCompanies = companies.filter((company) => query.companies.includes(company.slug));
  const companyName = selectedCompanies.length === 0
    ? null
    : selectedCompanies.length <= 3
      ? selectedCompanies.map((company) => company.displayName).join("、")
      : `${selectedCompanies.length} 家公司`;
  const pages = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
  const page = Math.min(query.page, pages);
  const visible = matched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div data-job-pending>
        <JobListSkeleton />
      </div>
      <div data-job-results>
        <div className="results-toolbar">
          <h2 id="job-count" className="results-count scroll-mt-6" aria-live="polite">
            {companyName ? <span className="results-company-name">{companyName}</span> : null}
            <span className="result-total">{matched.length}</span><span>个在招职位</span>
          </h2>
          {lastUpdatedAt ? (
            <p className="text-xs text-muted-foreground" title="最近一次抓取并写入职位的时间（北京时间）">
              最近更新：<time dateTime={lastUpdatedAt}>{formatUpdateTime(lastUpdatedAt)}</time>
            </p>
          ) : null}
        </div>
        {matched.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card px-5 py-10 text-center">
            <h2 className="font-display text-2xl">没有匹配的职位</h2>
            <p className="mt-2 text-sm text-muted-foreground">换一个关键词、公司或地点，或者清除筛选。</p>
            <button
              type="button"
              className="mt-4 text-sm text-primary underline-offset-4 hover:underline"
              onClick={() => writeBoardQuery(emptyBoardQuery())}
            >
              查看全部 {jobs.length} 个在招职位
            </button>
          </div>
        ) : (
          <section aria-labelledby="job-count">
            <ol className="job-results-list">
              {visible.map((job) => (
                <JobRow key={job.id} job={job} now={now} />
              ))}
            </ol>
            {pages > 1 ? (
              <div className="mt-4">
                <JobPagination
                  page={page} pages={pages} total={matched.length} pageSize={PAGE_SIZE} label="职位列表分页"
                  onChange={(nextPage) => {
                    writeBoardQuery({ ...query, page: nextPage });
                    document.getElementById("job-count")?.scrollIntoView({ block: "start" });
                  }}
                />
              </div>
            ) : null}
          </section>
        )}
      </div>
    </>
  );
}

function JobRow({ job, now }: { job: JobListItem; now: number | null }) {
  const when = job.publishTime ?? job.firstSeenAt;
  return (
    <li>
      <Link href={`/jobs/${job.id}`} className="job-result-link">
        <span className="company-monogram job-company-icon" data-company={job.companySlug} aria-hidden="true">{job.companyName.slice(0, 1)}</span>
        <div className="job-result-content">
          <h3>{job.title}</h3>
          <div className="job-result-meta"><span className="job-employer-name">{job.companyName}</span><span>{formatLocations(job.locations)}</span></div>
          <div className="job-result-tags">{job.category ? <Badge variant="secondary">{job.category}</Badge> : null}
            {now !== null && isFresh(job.firstSeenAt, now) ? <Badge variant="outline" className="fresh-badge">近 7 天收录</Badge> : null}
          </div>
        </div>
        <div className="job-result-side"><time dateTime={when}>{formatDate(when)}</time><span>查看职位</span></div>
      </Link>
    </li>
  );
}

function ScrapeHint() {
  return (
    <div className="rounded-2xl border bg-card px-5 py-8 sm:px-8">
      <h2 className="font-display text-3xl tracking-tight">库里还没有前端职位</h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
        先迁移数据库，再抓取已接入公司的公开前端社招。没有外网时可以用仓库里的中文样例。
      </p>
      <pre className="mt-5 overflow-x-auto rounded-xl bg-foreground px-4 py-3 text-sm text-background">
        npx prisma migrate dev{"\n"}npm run scrape
      </pre>
      <p className="mt-3 text-sm text-muted-foreground">
        离线：<code className="font-mono text-foreground">npm run scrape -- --offline</code>
      </p>
    </div>
  );
}
