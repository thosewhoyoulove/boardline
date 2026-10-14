import { ashbyApiAdapter } from "@/lib/crawlers/ashby_api";
import type { CrawlerAdapter } from "@/lib/crawlers/types";

const adapters: Record<string, CrawlerAdapter> = {
  [ashbyApiAdapter.sourceType]: ashbyApiAdapter,
};

export function getAdapter(sourceType: string): CrawlerAdapter | undefined {
  return adapters[sourceType];
}

export function listAdapterTypes(): string[] {
  return Object.keys(adapters);
}
