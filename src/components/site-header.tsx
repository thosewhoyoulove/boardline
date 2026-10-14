import { Suspense } from "react";
import Link from "next/link";

import { SiteNav } from "@/components/site-nav";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="group min-w-0">
          <span className="block font-display text-2xl leading-none tracking-tight text-foreground">职线</span>
          <span className="mt-1 block text-[0.7rem] tracking-[0.22em] text-muted-foreground uppercase">
            Boardline
          </span>
        </Link>
        <Suspense fallback={<div className="h-8 w-28 rounded-full bg-muted" />}>
          <SiteNav />
        </Suspense>
      </div>
      <div className="masthead-rule" aria-hidden="true" />
    </header>
  );
}
