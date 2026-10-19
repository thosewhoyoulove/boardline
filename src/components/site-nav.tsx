"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const links = [
  { href: "/", label: "职位", match: (pathname: string) => pathname === "/" || pathname.startsWith("/jobs") },
  { href: "/companies", label: "公司", match: (pathname: string) => pathname.startsWith("/companies") },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="主导航" className="flex items-center gap-1">
      {links.map((link) => {
        const active = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "site-nav-link",
              active
                ? "is-active"
                : "text-muted-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
