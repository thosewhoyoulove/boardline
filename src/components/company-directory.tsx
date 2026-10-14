import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { getCompanyDirectory } from "@/lib/db/queries";
import { recruitmentLabel, sourceLabel } from "@/lib/format";
import { safeHttpUrl } from "@/lib/http";

export async function CompanyDirectory() {
  const companies = await getCompanyDirectory();

  if (companies.length === 0) {
    return (
      <div className="rounded-2xl border bg-card px-5 py-8">
        <h2 className="font-display text-3xl">还没有公司</h2>
        <p className="mt-2 text-sm text-muted-foreground">运行 npm run scrape 会写入示例公司，并拉取公开职位。</p>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {companies.map((company) => {
        const careersUrl = safeHttpUrl(company.referralUrl);
        return (
          <li key={company.slug} className="flex flex-col rounded-2xl border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl tracking-tight">{company.displayName}</h2>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{company.slug}</p>
              </div>
              <p className="text-right text-sm">
                <span className="block font-display text-3xl leading-none">{company.openJobs}</span>
                <span className="text-muted-foreground">在招</span>
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {!company.active ? <Badge variant="destructive">已停用</Badge> : null}
              {company.sources.length === 0 ? <Badge variant="outline">无活跃数据源</Badge> : null}
              {company.sources.map((source) => (
                <Badge key={`${source.sourceType}-${source.recruitmentType}`} variant="secondary">
                  {sourceLabel(source.sourceType)} · {recruitmentLabel(source.recruitmentType)}
                </Badge>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-4 text-sm">
              <Link href={`/?company=${company.slug}`} className="text-primary underline-offset-4 hover:underline">
                查看职位
              </Link>
              {careersUrl ? (
                <a href={careersUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
                  官方招聘页
                </a>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function CompanyDirectoryFallback() {
  return <div className="h-56 animate-pulse rounded-2xl border bg-muted" aria-hidden="true" />;
}
