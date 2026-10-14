import { createHash } from "node:crypto";

export function contentHash(parts: {
  title: string;
  category: string | null;
  locations: string[];
  descriptionHtml: string | null;
  officialUrl: string;
}): string {
  const payload = JSON.stringify({
    title: parts.title,
    category: parts.category,
    locations: parts.locations,
    descriptionHtml: parts.descriptionHtml,
    officialUrl: parts.officialUrl,
  });
  return createHash("sha256").update(payload).digest("hex");
}
