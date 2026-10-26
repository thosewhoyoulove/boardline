import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";

import { PUBLISHED_JOBS_CACHE_TAG } from "@/lib/db/cache-tags";

/**
 * Drop the public board cache immediately.
 * `{ expire: 0 }` is the Route Handler equivalent of `updateTag`: the next
 * request misses instead of serving stale-while-revalidate HTML.
 * Path invalidation clears the prerendered `/`, `/companies`, and `/jobs/[id]`
 * responses (including the root layout) that Vercel may still be holding.
 */
export function invalidatePublishedBoardCache() {
  revalidateTag(PUBLISHED_JOBS_CACHE_TAG, { expire: 0 });
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/companies");
  revalidatePath("/jobs/[id]", "page");
}
