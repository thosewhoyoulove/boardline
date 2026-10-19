import { Suspense } from "react";
import Link from "next/link";

import { SiteNav } from "@/components/site-nav";

export function SiteHeader() {
  return (
    <header className="site-masthead">
      <div className="masthead-inner">
        <Link href="/" className="brand-link" aria-label="职线 Boardline 首页">
          <span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span>
          <span className="brand-name">职线<span>Boardline</span></span>
        </Link>
        <Suspense fallback={<div className="h-8 w-28 rounded-full bg-muted" />}>
          <SiteNav />
        </Suspense>
      </div>
    </header>
  );
}
