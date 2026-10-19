import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="site-footer-inner text-sm text-muted-foreground">
        <p>职线 Boardline<span className="mx-3 text-border">/</span>让找工作，更接近机会。</p>
        <Link href="/companies" className="underline-offset-4 hover:text-foreground hover:underline">
          查看已接入的公司
        </Link>
      </div>
    </footer>
  );
}
