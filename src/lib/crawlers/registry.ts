import { alibabaApiAdapter } from "@/lib/crawlers/alibaba_api";
import { ashbyApiAdapter } from "@/lib/crawlers/ashby_api";
import { bytedanceApiAdapter } from "@/lib/crawlers/bytedance_api";
import { ctripApiAdapter } from "@/lib/crawlers/ctrip_api";
import { didiApiAdapter } from "@/lib/crawlers/didi_api";
import { jdApiAdapter } from "@/lib/crawlers/jd_api";
import { meituanApiAdapter } from "@/lib/crawlers/meituan_api";
import { tencentApiAdapter } from "@/lib/crawlers/tencent_api";
import { xiaomiApiAdapter } from "@/lib/crawlers/xiaomi_api";
import type { CrawlerAdapter } from "@/lib/crawlers/types";

const adapters: Record<string, CrawlerAdapter> = {
  [ashbyApiAdapter.sourceType]: ashbyApiAdapter,
  [tencentApiAdapter.sourceType]: tencentApiAdapter,
  [bytedanceApiAdapter.sourceType]: bytedanceApiAdapter,
  [meituanApiAdapter.sourceType]: meituanApiAdapter,
  [xiaomiApiAdapter.sourceType]: xiaomiApiAdapter,
  [alibabaApiAdapter.sourceType]: alibabaApiAdapter,
  [didiApiAdapter.sourceType]: didiApiAdapter,
  [jdApiAdapter.sourceType]: jdApiAdapter,
  [ctripApiAdapter.sourceType]: ctripApiAdapter,
};

export function getAdapter(sourceType: string): CrawlerAdapter | undefined {
  return adapters[sourceType];
}

export function listAdapterTypes(): string[] {
  return Object.keys(adapters);
}
