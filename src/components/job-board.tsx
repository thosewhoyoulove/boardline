import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { getJobBoard, PAGE_SIZE, type JobFilters, type JobListItem } from "@/lib/db/queries";
import { boardHref, formatDate, formatLocations, isFresh, readCompanySlug, readPage, readQueryValue } from "@/lib/format";

export async function JobBoard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = readFilters(params);
  let board;
  try {
    board = await getJobBoard(filters);
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取职位失败";
    return (
      <div className="rounded-2xl border bg-card px-5 py-8">
        <h2 className="font-display text-3xl">职位暂时读不出来</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>
      </div>
    );
  }
  const companyName = board.companies.find((company) => company.slug === filters.company)?.displayName;

  if (board.unfilteredTotal === 0) return <ScrapeHint />;

  if (board.total === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-card px-5 py-10 text-center">
        <h2 className="font-display text-2xl">没有匹配的职位</h2>
        <p className="mt-2 text-sm text-muted-foreground">换一个关键词、公司或地点，或者清除筛选。</p>
        <Link href="/" className="mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline">
          查看全部 {board.unfilteredTotal} 个在招职位
        </Link>
      </div>
    );
  }

  return (
    <section aria-labelledby="job-count">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="job-count" className="text-sm text-muted-foreground">
          {companyName ? `${companyName} · ` : ""}
          {board.total} 个在招职位
          {board.total > PAGE_SIZE ? `，第 ${board.page} / ${Math.ceil(board.total / PAGE_SIZE)} 页` : ""}
        </h2>
      </div>
      <ol className="divide-y overflow-hidden rounded-2xl border bg-card">
        {board.jobs.map((job) => (
          <JobRow key={job.id} job={job} />
        ))}
      </ol>
      <Pagination filters={filters} page={board.page} total={board.total} />
    </section>
  );
}

function JobRow({ job }: { job: JobListItem }) {
  return (
    <li>
      <Link href={`/jobs/${job.id}`} className="block px-4 py-4 transition-colors hover:bg-muted/70 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-primary">{job.companyName}</p>
          <time dateTime={job.publishTime?.toISOString()} className="shrink-0 text-xs text-muted-foreground">
            {formatDate(job.publishTime ?? job.firstSeenAt)}
          </time>
        </div>
        <h3 className="mt-1 font-display text-xl leading-snug tracking-tight sm:text-[1.35rem]">{job.title}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{formatLocations(job.locations)}</span>
          {job.category ? <Badge variant="secondary">{job.category}</Badge> : null}
          {isFresh(job.firstSeenAt) ? <Badge variant="outline">新收录</Badge> : null}
        </div>
      </Link>
    </li>
  );
}

function Pagination({
  filters,
  page,
  total,
}: {
  filters: JobFilters;
  page: number;
  total: number;
}) {
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) return null;

  return (
    <nav aria-label="分页" className="mt-4 flex items-center justify-between text-sm">
      {page > 1 ? (
        <Link
          href={boardHref({ ...filters, page: page - 1 })}
          className="rounded-full border bg-card px-3 py-1.5 hover:bg-muted"
        >
          上一页
        </Link>
      ) : (
        <span />
      )}
      {page < pages ? (
        <Link
          href={boardHref({ ...filters, page: page + 1 })}
          className="rounded-full border bg-card px-3 py-1.5 hover:bg-muted"
        >
          下一页
        </Link>
      ) : (
        <span />
      )}
    </nav>
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

function readFilters(params: Record<string, string | string[] | undefined>): JobFilters {
  return {
    q: readQueryValue(params.q),
    company: readCompanySlug(params.company),
    location: readQueryValue(params.location),
    page: readPage(params.page),
  };
}
