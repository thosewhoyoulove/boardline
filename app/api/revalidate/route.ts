import { invalidatePublishedBoardCache } from "@/lib/db/invalidate-board";
import { PUBLISHED_JOBS_CACHE_TAG } from "@/lib/db/cache-tags";
import { authorizeRevalidate } from "@/lib/revalidate-auth";

const noStore = { "cache-control": "private, no-store" };

export async function POST(request: Request) {
  const auth = authorizeRevalidate(request.headers.get("authorization"), process.env.REVALIDATE_SECRET);
  if (!auth.ok) {
    const error = auth.status === 503 ? "REVALIDATE_SECRET is not configured" : "unauthorized";
    return Response.json({ revalidated: false, error }, { status: auth.status, headers: noStore });
  }

  invalidatePublishedBoardCache();

  return Response.json(
    {
      revalidated: true,
      tag: PUBLISHED_JOBS_CACHE_TAG,
      paths: ["/", "/companies", "/jobs/[id]"],
    },
    { headers: noStore },
  );
}
