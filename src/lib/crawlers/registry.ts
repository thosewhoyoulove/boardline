import { ashbyApiAdapter } from "@/lib/crawlers/ashby_api";
import { bytedanceApiAdapter } from "@/lib/crawlers/bytedance_api";
import { meituanApiAdapter } from "@/lib/crawlers/meituan_api";
import { tencentApiAdapter } from "@/lib/crawlers/tencent_api";
import type { CrawlerAdapter } from "@/lib/crawlers/types";

const adapters: Record<string, CrawlerAdapter> = {
  [ashbyApiAdapter.sourceType]: ashbyApiAdapter,
  [tencentApiAdapter.sourceType]: tencentApiAdapter,
  [bytedanceApiAdapter.sourceType]: bytedanceApiAdapter,
  [meituanApiAdapter.sourceType]: meituanApiAdapter,
};

export function getAdapter(sourceType: string): CrawlerAdapter | undefined {
  return adapters[sourceType];
}

export function listAdapterTypes(): string[] {
  return Object.keys(adapters);
}
