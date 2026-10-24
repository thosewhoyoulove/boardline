export type Page = { items: unknown[]; total?: number };
export type PageCollection = { items: unknown[]; pages: number; complete: boolean; note: string };

export function pageTotal(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
    if (typeof value === "string" && /^\d+$/.test(value)) {
      const number = Number(value);
      if (Number.isSafeInteger(number)) return number;
    }
  }
  return undefined;
}

/** Only exhausted lists permit reconciliation; a successful first page does not. */
export async function collectPages(options: {
  maxPages: number;
  fetchPage(page: number, offset: number): Promise<Page>;
  identify(item: unknown): unknown;
}): Promise<PageCollection> {
  const items: unknown[] = [];
  const seen = new Set<string>();
  let pages = 0;
  let expectedTotal: number | undefined;
  let unstable = false;
  const result = (complete: boolean, reason: string): PageCollection => ({
    items, pages, complete: complete && !unstable,
    note: `已读取 ${pages} 页、${items.length} 条原始职位；${reason}${unstable ? "；列表重叠或总数变化，保留旧岗位" : ""}`,
  });
  for (let page = 1; page <= options.maxPages; page += 1) {
    let payload: Page;
    try { payload = await options.fetchPage(page, items.length); }
    catch (error) {
      if (pages === 0) throw error;
      return result(false, `第 ${page} 页失败：${error instanceof Error ? error.message : "未知错误"}`);
    }
    pages += 1;
    if (payload.total !== undefined) {
      if (expectedTotal !== undefined && expectedTotal !== payload.total) unstable = true;
      expectedTotal = payload.total;
    }
    if (payload.items.length === 0) {
      const complete = items.length > 0 || expectedTotal === 0;
      return result(complete && (expectedTotal === undefined || items.length === expectedTotal), "已到列表末尾");
    }
    let added = 0;
    for (const item of payload.items) {
      const id = options.identify(item);
      if ((typeof id !== "string" && typeof id !== "number") || String(id).trim() === "") {
        unstable = true;
        continue;
      }
      const key = String(id);
      if (seen.has(key)) { unstable = true; continue; }
      seen.add(key);
      items.push(item);
      added += 1;
    }
    if (added === 0) return result(false, "分页没有新增职位，停止重复请求");
    if (expectedTotal !== undefined && items.length >= expectedTotal) {
      return result(items.length === expectedTotal, "已读取接口声明的总数");
    }
    // A short page alone is not exhaustion: upstream may silently cap page size.
  }
  return result(false, `达到 ${options.maxPages} 页上限，保留旧岗位`);
}
