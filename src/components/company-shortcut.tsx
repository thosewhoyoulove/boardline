"use client";

import { emptyBoardQuery, writeBoardQuery } from "@/lib/board-query";

export function CompanyShortcut({ slug, name }: { slug: string; name: string }) {
  return (
    <a
      href={`/?company=${slug}`}
      className="employer-shortcut"
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        writeBoardQuery({ ...emptyBoardQuery(), company: slug });
      }}
    >
      <span className="company-monogram" data-company={slug} aria-hidden="true">{name.slice(0, 1)}</span>
      <span>{name}</span>
    </a>
  );
}
