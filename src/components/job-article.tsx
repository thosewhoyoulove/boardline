import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getJobDetail } from "@/lib/db/queries";
import { formatDate, formatLocations, hostOf, recruitmentLabel, sourceLabel } from "@/lib/format";
import { safeHttpUrl } from "@/lib/http";
import { sanitizeDescription } from "@/lib/crawlers/sanitize";
import { cn } from "cn";

export async function JobArticle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJobDetail(id);
  if (!job) return <MissingJob />;

  const applyUrl = safeHttpUrl(job.officialUrl);
  const descriptionHtml = sanitizeDescription(job.descriptionHtml);
  const careersUrl = safeHttpUrl(job.referralUrl);

  return (
    <article className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <div className="min-w-0">
        <p className="text-sm">
          <Link href="/" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            职位
          </Link>
          <span className="px-2 text-muted-foreground">/</span>
          <Link
            href={`/?company=${job.companySlug}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            {job.companyName}
          </Link>
        </p>
        <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">{job.title}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{formatLocations(job.locations)}</span>
          {job.category ? <Badge variant="secondary">{job.category}</Badge> : null}
          <Badge variant="outline">{recruitmentLabel(job.recruitmentType)}</Badge>
          {!job.isActive ? <Badge variant="destructive">已不在来源列表</Badge> : null}
        </div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">发布时间</dt>
            <dd>{formatDate(job.publishTime)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">首次收录</dt>
            <dd>{formatDate(job.firstSeenAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">最近确认</dt>
            <dd>{formatDate(job.lastSeenAt)}</dd>
          </div>
        </dl>

        <div className="mt-8 border-t pt-6 lg:hidden">
          <ApplyPanel applyUrl={applyUrl} companyName={job.companyName} careersUrl={careersUrl} />
        </div>

        {descriptionHtml ? (
          <div className="job-prose mt-8" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
        ) : job.descriptionText ? (
          <p className="mt-8 text-base leading-7 whitespace-pre-wrap">{job.descriptionText}</p>
        ) : (
          <p className="mt-8 text-sm text-muted-foreground">来源没有提供职位描述。请以官方页面为准。</p>
        )}
        <p className="mt-8 text-xs text-muted-foreground">来源：{sourceLabel(job.sourceType)}</p>
      </div>

      <aside className="hidden lg:sticky lg:top-6 lg:block">
        <ApplyPanel applyUrl={applyUrl} companyName={job.companyName} careersUrl={careersUrl} />
      </aside>
    </article>
  );
}

function MissingJob() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-xs tracking-[0.18em] text-primary uppercase">404</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">没有这条职位</h1>
      <p className="mt-3 text-muted-foreground">它可能已被删掉，或者链接不完整。</p>
      <Link href="/" className="mt-6 inline-block text-primary underline-offset-4 hover:underline">
        返回职位列表
      </Link>
    </div>
  );
}

function ApplyPanel({
  applyUrl,
  companyName,
  careersUrl,
}: {
  applyUrl: string | null;
  companyName: string;
  careersUrl?: string | null;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="text-xs tracking-[0.16em] text-primary uppercase">官方申请</p>
      <h2 className="mt-2 font-display text-2xl leading-tight">只在 {companyName} 的页面投递</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        职线不代投简历，也不会把你带到第三方申请表。
      </p>
      {applyUrl ? (
        <a
          href={applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ size: "lg" }), "mt-4 h-10 w-full")}
        >
          打开官方申请页
        </a>
      ) : (
        <p className="mt-4 text-sm">这条职位没有可安全打开的官方链接。</p>
      )}
      {applyUrl ? <p className="mt-3 text-xs text-muted-foreground">{hostOf(applyUrl)}</p> : null}
      {careersUrl ? (
        <a
          href={careersUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block text-sm text-primary underline-offset-4 hover:underline"
        >
          公司招聘页
        </a>
      ) : null}
    </div>
  );
}

export function JobArticleFallback() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6" aria-hidden="true">
      <div className="h-8 w-40 rounded bg-muted" />
      <div className="mt-4 h-16 max-w-xl animate-pulse rounded bg-muted" />
      <div className="mt-8 h-48 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
