"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { JobListSkeleton } from "@/components/job-skeletons";
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
import { formatDate, formatLocations, isFresh } from "@/lib/format";

export function JobBoard({ jobs, companies }: { jobs: JobListItem[]; companies: CompanyOption[] }) {
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
  const companyName = companies.find((company) => company.slug === query.company)?.displayName;
  const pages = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
  const page = Math.min(query.page, pages);
  const visible = matched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div data-job-pending>
        <JobListSkeleton />
      </div>
      <div data-job-results>
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
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="job-count" className="text-sm text-muted-foreground">
                {companyName ? `${companyName} · ` : ""}
                {matched.length} 个在招职位
                {matched.length > PAGE_SIZE ? `，第 ${page} / ${pages} 页` : ""}
              </h2>
            </div>
            <ol className="divide-y overflow-hidden rounded-2xl border bg-card">
              {visible.map((job) => (
                <JobRow key={job.id} job={job} now={now} />
              ))}
            </ol>
            {pages > 1 ? (
              <nav aria-label="分页" className="mt-4 flex items-center justify-between text-sm">
                {page > 1 ? (
                  <button
                    type="button"
                    className="rounded-full border bg-card px-3 py-1.5 hover:bg-muted"
                    onClick={() => writeBoardQuery({ ...query, page: page - 1 })}
                  >
                    上一页
                  </button>
                ) : (
                  <span />
                )}
                {page < pages ? (
                  <button
                    type="button"
                    className="rounded-full border bg-card px-3 py-1.5 hover:bg-muted"
                    onClick={() => writeBoardQuery({ ...query, page: page + 1 })}
                  >
                    下一页
                  </button>
                ) : (
                  <span />
                )}
              </nav>
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
      <Link href={`/jobs/${job.id}`} className="block px-4 py-4 transition-colors hover:bg-muted/70 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-primary">{job.companyName}</p>
          <time dateTime={when} className="shrink-0 text-xs text-muted-foreground">
            {formatDate(when)}
          </time>
        </div>
        <h3 className="mt-1 font-display text-xl leading-snug tracking-tight sm:text-[1.35rem]">{job.title}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{formatLocations(job.locations)}</span>
          {job.category ? <Badge variant="secondary">{job.category}</Badge> : null}
          {now !== null && isFresh(job.firstSeenAt, now) ? <Badge variant="outline">新收录</Badge> : null}
        </div>
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
