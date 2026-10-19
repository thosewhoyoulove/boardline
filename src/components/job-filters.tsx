"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { BOARD_QUERY_EVENT, readBoardQuery, writeBoardQuery } from "@/lib/board-query";
import { cn } from "cn";

export type FilterCompany = {
  slug: string;
  displayName: string;
};

export function JobFilters({ companies }: { companies: FilterCompany[] }) {
  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [company, setCompany] = useState("");
  const writeTimer = useRef<number | null>(null);

  useEffect(() => {
    function syncFromUrl() {
      const next = readBoardQuery();
      setQ(next.q);
      setLocation(next.location);
      setCompany(next.company);
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

  function schedule(next: { q: string; company: string; location: string }) {
    if (writeTimer.current) window.clearTimeout(writeTimer.current);
    writeTimer.current = window.setTimeout(() => {
      writeBoardQuery({
        q: next.q.trim(),
        company: next.company,
        location: next.location.trim(),
        page: 1,
      });
    }, 280);
  }

  function writeNow(next: { q: string; company: string; location: string }) {
    if (writeTimer.current) window.clearTimeout(writeTimer.current);
    writeBoardQuery({
      q: next.q.trim(),
      company: next.company,
      location: next.location.trim(),
      page: 1,
    });
  }

  function chooseCompany(slug: string) {
    setCompany(slug);
    writeNow({ q, company: slug, location });
  }

  const hasFilters = Boolean(q.trim() || location.trim() || company);

  return (
    <div className="filter-panel">
      <div className="mb-3 flex min-h-5 items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">筛选职位</h2>
        {hasFilters ? (
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            onClick={() => {
              setQ("");
              setLocation("");
              setCompany("");
              writeNow({ q: "", company: "", location: "" });
            }}
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
              schedule({ q: value, company, location });
            }}
            placeholder="搜索职位、技能或团队"
            autoComplete="off"
          />
        </label>
        <CompanyMenu companies={companies} value={company} onChange={chooseCompany} />
        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
          地点
          <Input
            value={location}
            onChange={(event) => {
              const value = event.target.value;
              setLocation(value);
              schedule({ q, company, location: value });
            }}
            placeholder="例如：北京、上海"
            autoComplete="off"
          />
        </label>
      </div>
    </div>
  );
}

function CompanyMenu({
  companies,
  value,
  onChange,
}: {
  companies: FilterCompany[];
  value: string;
  onChange: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const options = [{ slug: "", displayName: "全部公司" }, ...companies];
  const selected = options.find((option) => option.slug === value) ?? options[0];

  function openMenu() {
    setActiveIndex(Math.max(0, options.findIndex((option) => option.slug === value)));
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.slug);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative grid gap-1.5 text-xs font-medium text-muted-foreground">
      <span id={`${listId}-label`}>公司</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${listId}-label`}
        className={cn(
          "flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm text-foreground outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          open && "border-ring ring-3 ring-ring/50",
        )}
        onClick={() => {
          if (open) setOpen(false);
          else openMenu();
        }}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            openMenu();
            return;
          }
          if (!open) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => Math.min(options.length - 1, current + 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => Math.max(0, current - 1));
          } else if (event.key === "Enter") {
            event.preventDefault();
            choose(activeIndex);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
        }}
      >
        <span className="truncate">{selected.displayName}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={`${listId}-label`}
          className="absolute top-[calc(100%+6px)] z-30 max-h-72 w-full overflow-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-[0_18px_40px_-24px_rgba(48,36,12,0.55)]"
        >
          {options.map((option, index) => {
            const selectedOption = option.slug === value;
            return (
              <li key={option.slug || "all"} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedOption}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm",
                    selectedOption
                      ? "bg-primary text-primary-foreground"
                      : index === activeIndex
                        ? "bg-muted text-foreground"
                        : "text-foreground hover:bg-muted",
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(index)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setActiveIndex((current) => Math.min(options.length - 1, current + 1));
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setActiveIndex((current) => Math.max(0, current - 1));
                    } else if (event.key === "Enter") {
                      event.preventDefault();
                      choose(index);
                    }
                  }}
                >
                  <span className="truncate">{option.displayName}</span>
                  {selectedOption ? <Check className="size-4 shrink-0" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
