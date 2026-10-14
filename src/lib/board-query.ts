import { boardHref, readCompanySlug, readPage, readQueryValue } from "@/lib/format";

export type BoardQuery = {
  q: string;
  company: string;
  location: string;
  page: number;
};

export const BOARD_QUERY_EVENT = "boardline:query";

export const PAGE_SIZE = 20;

export const emptyBoardQuery = (): BoardQuery => ({ q: "", company: "", location: "", page: 1 });

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
    if (query.company && job.companySlug !== query.company) return false;
    if (location && !job.locations.some((item) => item.toLocaleLowerCase().includes(location))) return false;
    if (!keyword) return true;
    const haystack = [job.title, job.companyName, job.category ?? "", job.descriptionText ?? "", ...job.locations]
      .join("\n")
      .toLocaleLowerCase();
    return haystack.includes(keyword);
  });
}

export function readBoardQuery(): BoardQuery {
  const params = new URLSearchParams(window.location.search);
  return {
    q: readQueryValue(params.get("q") ?? undefined),
    company: readCompanySlug(params.get("company") ?? undefined),
    location: readQueryValue(params.get("location") ?? undefined),
    page: readPage(params.get("page") ?? undefined),
  };
}

export function writeBoardQuery(next: BoardQuery) {
  const href = boardHref({
    q: next.q,
    company: next.company,
    location: next.location,
    page: next.page,
  });
  window.history.replaceState(window.history.state, "", href);
  window.dispatchEvent(new Event(BOARD_QUERY_EVENT));
}
