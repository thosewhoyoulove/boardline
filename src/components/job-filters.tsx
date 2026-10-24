"use client";

import { useEffect, useRef, useState } from "react";

import { CompanyFilter, type FilterCompany } from "@/components/company-filter";
import { Input } from "@/components/ui/input";
import { BOARD_QUERY_EVENT, readBoardQuery, stageBoardText, writeBoardQuery } from "@/lib/board-query";

export type { FilterCompany };

export function JobFilters({ companies }: { companies: FilterCompany[] }) {
  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const writeTimer = useRef<number | null>(null);

  useEffect(() => {
    function syncFromUrl() {
      const next = readBoardQuery();
      setQ(next.q);
      setLocation(next.location);
      setSelectedCompanies(next.companies);
    }
    const timer = window.setTimeout(syncFromUrl, 0);
    window.addEventListener("popstate", syncFromUrl);
    window.addEventListener(BOARD_QUERY_EVENT, syncFromUrl);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("popstate", syncFromUrl);
      window.removeEventListener(BOARD_QUERY_EVENT, syncFromUrl);
      if (writeTimer.current) window.clearTimeout(writeTimer.current);
    };
  }, []);

  function schedule(next: { q: string; location: string }) {
    stageBoardText(next);
    if (writeTimer.current) window.clearTimeout(writeTimer.current);
    writeTimer.current = window.setTimeout(() => {
      const current = readBoardQuery();
      writeBoardQuery({
        q: current.q.trim(),
        companies: current.companies,
        location: current.location.trim(),
        page: 1,
      });
    }, 280);
  }

  function writeNow(next: { q: string; location: string; companies: string[] }) {
    if (writeTimer.current) window.clearTimeout(writeTimer.current);
    stageBoardText(null);
    writeBoardQuery({
      q: next.q.trim(),
      companies: next.companies,
      location: next.location.trim(),
      page: 1,
    });
  }

  const hasFilters = Boolean(q.trim() || location.trim() || selectedCompanies.length);

  return (
    <div className="filter-panel">
      <div className="mb-3 flex min-h-5 items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">筛选职位</h2>
        {hasFilters ? (
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            onClick={() => writeNow({ q: "", location: "", companies: [] })}
          >
            清除
          </button>
        ) : null}
      </div>
      <div className="filter-fields">
        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
          关键词
          <Input
            value={q}
            onChange={(event) => {
              const value = event.target.value;
              setQ(value);
              schedule({ q: value, location });
            }}
            placeholder="搜索职位、技能或团队"
            autoComplete="off"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
          地点
          <Input
            value={location}
            onChange={(event) => {
              const value = event.target.value;
              setLocation(value);
              schedule({ q, location: value });
            }}
            placeholder="例如：北京、上海"
            autoComplete="off"
          />
        </label>
        <CompanyFilter companies={companies} variant="panel" />
      </div>
    </div>
  );
}
