"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";

function pageItems(page: number, pages: number, compact = false): Array<number | string> {
  if (compact && pages > 5) {
    const numbers = [...new Set([1, ...(page <= 2 ? [2, 3] : page >= pages - 1 ? [pages - 2, pages - 1] : [page]), pages])];
    return numbers.flatMap((number, index) => index > 0 && number - numbers[index - 1] > 1 ? [`gap-${number}`, number] : [number]);
  }
  const start = Math.max(2, Math.min(page - 1, pages - 4));
  const end = Math.min(pages - 1, Math.max(page + 1, 5));
  const numbers = pages <= 7 ? Array.from({ length: pages }, (_, i) => i + 1)
    : [1, ...Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i), pages];
  return numbers.flatMap((number, index) => index > 0 && number - numbers[index - 1] > 1 ? [`gap-${number}`, number] : [number]);
}

export function JobPagination({ page, pages, total, pageSize, onChange, label }: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onChange(page: number): void;
  label: string;
}) {
  const control = "inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg border bg-card px-3 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-card";
  return (
    <nav aria-label={label} className="job-pagination">
      <p className="pagination-summary text-xs tabular-nums text-muted-foreground">显示 {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} 条，共 {total} 条</p>
      {[false, true].map((compact) => (
        <div key={String(compact)} className={cn("pagination-pages items-center gap-1", compact ? "flex sm:hidden" : "hidden sm:flex")}>
          {pageItems(page, pages, compact).map((item) => typeof item === "number" ? (
            <button
              key={item} type="button" aria-label={`第 ${item} 页`} aria-current={page === item ? "page" : undefined}
              className={cn(control, "px-2 font-medium tabular-nums", page === item && "border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary")}
              onClick={() => { if (item !== page) onChange(item); }}
            >{item}</button>
          ) : <span key={item} aria-hidden="true" className="px-1 text-muted-foreground">…</span>)}
        </div>
      ))}
      <div className="pagination-actions flex shrink-0 gap-2">
        <button type="button" disabled={page === 1} className={control} onClick={() => onChange(page - 1)}>
          <ChevronLeft aria-hidden="true" className="size-4" />上一页
        </button>
        <button type="button" disabled={page === pages} className={control} onClick={() => onChange(page + 1)}>
          下一页<ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </div>
    </nav>
  );
}
