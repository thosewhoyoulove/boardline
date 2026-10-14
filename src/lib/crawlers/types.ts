export type RecruitmentType = "social" | "campus";

export type NormalizedJob = {
  uniqueKey: string;
  externalId: string;
  title: string;
  category: string | null;
  locations: string[];
  descriptionHtml: string | null;
  descriptionText: string | null;
  officialUrl: string;
  publishTime: Date | null;
  contentHash: string;
};

export type AdapterFetchResult = {
  jobs: NormalizedJob[];
  /** When false, missing rows must not be marked inactive (partial/fixture data). */
  authoritative: boolean;
  note?: string;
};

export type AdapterContext = {
  config: unknown;
  offline: boolean;
};

export interface CrawlerAdapter {
  sourceType: string;
  fetchJobs(context: AdapterContext): Promise<AdapterFetchResult>;
}
