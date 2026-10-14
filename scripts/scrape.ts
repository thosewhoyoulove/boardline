import { formatScrapeReport, runScrape } from "@/lib/crawlers/run";

const offline = process.argv.includes("--offline") || process.env.SCRAPE_OFFLINE === "1";

runScrape({ offline })
  .then((report) => {
    console.log(formatScrapeReport(report));
    process.exit(report.ok ? 0 : 1);
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
