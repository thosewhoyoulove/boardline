import { boardHref, readCompanySlugs, readPage, readQueryValue } from "@/lib/format";

export type BoardQuery = {
  q: string;
  companies: string[];
  location: string;
  page: number;
};

export const BOARD_QUERY_EVENT = "boardline:query";

export const PAGE_SIZE = 20;

export const emptyBoardQuery = (): BoardQuery => ({ q: "", companies: [], location: "", page: 1 });

/** Keyword and location edits stay here until the debounced URL write. */
let uncommittedText: { q: string; location: string } | null = null;

export function stageBoardText(next: { q: string; location: string } | null) {
  uncommittedText = next;
}

type FilterableJob = {
  title: string;
  companyName: string;
  companySlug: string;
  category: string | null;
  locations: string[];
  descriptionText: string | null;
};

export function filterJobs<T extends FilterableJob>(jobs: T[], query: BoardQuery): T[] {
  const keyword = query.q.trim().toLocaleLowerCase();
  const location = query.location.trim().toLocaleLowerCase();
  return jobs.filter((job) => {
    if (query.companies.length > 0 && !query.companies.includes(job.companySlug)) return false;
    if (location && !job.locations.some((item) => item.toLocaleLowerCase().includes(location))) return false;
    if (!keyword) return true;
    const haystack = [job.title, job.companyName, job.category ?? "", job.descriptionText ?? "", ...job.locations]
      .join("\n")
      .toLocaleLowerCase();
    return haystack.includes(keyword);
  });
}

export function boardQueryFromParams(params: URLSearchParams): BoardQuery {
  return {
    q: readQueryValue(params.get("q") ?? undefined),
    companies: readCompanySlugs(params.getAll("company")),
    location: readQueryValue(params.get("location") ?? undefined),
    page: readPage(params.get("page") ?? undefined),
  };
}

export function readBoardQuery(): BoardQuery {
  const query = boardQueryFromParams(new URLSearchParams(window.location.search));
  if (!uncommittedText) return query;
  return { ...query, q: uncommittedText.q, location: uncommittedText.location };
}

export function writeBoardQuery(next: BoardQuery) {
  uncommittedText = null;
  const href = boardHref({
    q: next.q,
    companies: next.companies,
    location: next.location,
    page: next.page,
  });
  window.history.replaceState(window.history.state, "", href);
  window.dispatchEvent(new Event(BOARD_QUERY_EVENT));
}
