"use client";

import { Check, ChevronDown, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { BOARD_QUERY_EVENT, readBoardQuery, writeBoardQuery } from "@/lib/board-query";
import { cn } from "cn";
import { CompanyLogo } from "@/components/company-logo";
import { CompanyShortcut } from "@/components/company-shortcut";

export type FilterCompany = {
  slug: string;
  displayName: string;
};

export function CompanyFilter({
  companies,
  variant,
}: {
  companies: FilterCompany[];
  variant: "hero" | "panel";
}) {
  const picker = <CompanyPicker companies={companies} labelled={variant === "panel"} />;
  if (variant === "panel") return <div className="company-filter-panel">{picker}</div>;
  return (
    <div className="company-filter-card">
      <div className="employer-heading">
        <h2>从感兴趣的公司开始</h2>
        <Link href="/companies">查看公司目录</Link>
      </div>
      <div className="employer-grid" aria-label="按公司查看职位">
        {companies.map(company => <CompanyShortcut key={company.slug} slug={company.slug} name={company.displayName} />)}
      </div>
      {picker}
    </div>
  );
}

function CompanyPicker({ companies, labelled }: { companies: FilterCompany[]; labelled: boolean }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    function sync() {
      setSelected(readBoardQuery().companies);
    }
    const timer = window.setTimeout(sync, 0);
    window.addEventListener("popstate", sync);
    window.addEventListener(BOARD_QUERY_EVENT, sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("popstate", sync);
      window.removeEventListener(BOARD_QUERY_EVENT, sync);
    };
  }, []);

  const visible = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase();
    if (!keyword) return companies;
    return companies.filter((company) =>
      `${company.displayName} ${company.slug}`.toLocaleLowerCase().includes(keyword),
    );
  }, [companies, search]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function commit(next: string[]) {
    const current = readBoardQuery();
    writeBoardQuery({ ...current, companies: next, page: 1 });
  }

  function toggle(slug: string) {
    const current = readBoardQuery().companies;
    commit(current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]);
  }

  const summary = selected.length === 0 ? `全部公司 · ${companies.length} 家` : `已选 ${selected.length} 家`;

  return (
    <div ref={rootRef} className="company-filter">
      {labelled ? <span id={`${listId}-label`} className="text-xs font-medium text-muted-foreground">公司</span> : null}
      <button
        type="button"
        className="company-filter-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelled ? `${listId}-label` : undefined}
        onClick={() => {
          setSearch("");
          setActiveIndex(0);
          setOpen((value) => !value);
        }}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {selected.length > 0 ? (
        <ul className="company-chip-list" aria-label="已选公司">
          {selected.map((slug) => {
            const name = companies.find((company) => company.slug === slug)?.displayName ?? slug;
            return (
              <li key={slug}>
                <span className="company-chip">
                  <CompanyLogo slug={slug} name={name} className="is-chip" />
                  <span>{name}</span>
                  <button type="button" aria-label={`移除${name}`} onClick={() => toggle(slug)}>
                    <X className="size-3.5" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {open ? (
        <div id={listId} role="dialog" aria-label="选择公司" className="company-filter-menu">
          <input
            ref={searchRef}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setActiveIndex(0);
            }}
            placeholder="搜索公司"
            aria-label="搜索公司"
            autoComplete="off"
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((current) => Math.min(visible.length - 1, current + 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((current) => Math.max(0, current - 1));
              } else if (event.key === "Enter" && visible[activeIndex]) {
                event.preventDefault();
                toggle(visible[activeIndex].slug);
              }
            }}
          />
          {visible.length === 0 ? (
            <p className="company-filter-empty">没有匹配的公司</p>
          ) : (
            <ul role="listbox" aria-multiselectable="true" aria-label="公司列表">
              {visible.map((company, index) => {
                const checked = selected.includes(company.slug);
                return (
                  <li key={company.slug} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={checked}
                      className={cn(checked && "is-selected", index === activeIndex && "is-active")}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => toggle(company.slug)}
                    >
                      <span className="company-option-label"><CompanyLogo slug={company.slug} name={company.displayName} className="is-chip" /><span className="truncate">{company.displayName}</span></span>
                      {checked ? <Check className="size-4 shrink-0" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {selected.length > 0 ? (
            <button type="button" className="company-filter-clear" onClick={() => commit([])}>
              清除已选
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
