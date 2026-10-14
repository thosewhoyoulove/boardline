"use client";

import { Check, ChevronDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { boardHref } from "@/lib/format";
import { cn } from "cn";

export type FilterCompany = {
  slug: string;
  displayName: string;
};

export function JobFilters({ companies }: { companies: FilterCompany[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const urlQ = params.get("q") ?? "";
  const urlCompany = params.get("company") ?? "";
  const urlLocation = params.get("location") ?? "";

  const [q, setQ] = useState(urlQ);
  const [location, setLocation] = useState(urlLocation);
  const [company, setCompany] = useState(urlCompany);
  const keywordRef = useRef<HTMLInputElement>(null);
  const locationRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function syncFromHistory() {
      const next = new URLSearchParams(window.location.search);
      setQ(next.get("q") ?? "");
      setLocation(next.get("location") ?? "");
      setCompany(next.get("company") ?? "");
    }
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);

  useEffect(() => {
    const trimmed = { q: q.trim(), company, location: location.trim() };
    if (trimmed.q === urlQ && trimmed.company === urlCompany && trimmed.location === urlLocation) return;
    const handle = window.setTimeout(() => {
      router.replace(boardHref(trimmed), { scroll: false });
    }, 280);
    return () => window.clearTimeout(handle);
  }, [q, location, company, urlQ, urlCompany, urlLocation, router]);

  function replaceNow(next: { q: string; company: string; location: string }) {
    const trimmed = { q: next.q.trim(), company: next.company, location: next.location.trim() };
    if (trimmed.q === urlQ && trimmed.company === urlCompany && trimmed.location === urlLocation) return;
    router.replace(boardHref(trimmed), { scroll: false });
  }

  function chooseCompany(slug: string) {
    setCompany(slug);
    replaceNow({ q, company: slug, location });
  }

  const hasFilters = Boolean(urlQ || urlCompany || urlLocation || q || location || company);

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">改一个条件，列表会跟着更新</p>
        {hasFilters ? (
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            onClick={() => {
              setQ("");
              setLocation("");
              setCompany("");
              router.replace("/", { scroll: false });
            }}
          >
            清除
          </button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
          关键词
          <Input
            ref={keywordRef}
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="标题、团队、描述"
            autoComplete="off"
          />
        </label>
        <CompanyMenu companies={companies} value={company} onChange={chooseCompany} />
        <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
          地点
          <Input
            ref={locationRef}
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="城市"
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
