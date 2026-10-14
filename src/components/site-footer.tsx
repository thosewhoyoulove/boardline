import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>只链到招聘方自己的申请页。请控制抓取频率，并遵守来源站点的条款。</p>
        <Link href="/companies" className="underline-offset-4 hover:text-foreground hover:underline">
          查看已接入的公司
        </Link>
      </div>
    </footer>
  );
}
