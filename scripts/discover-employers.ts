import "dotenv/config";
import { appendFile, writeFile } from "node:fs/promises";
import { discoverEmployers } from "@/lib/crawlers/discover";
import { getPrisma } from "@/lib/db/client";

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--dry-run")) throw new Error("支持的参数：--dry-run（仅校验，不添加公司或职位）");
  try {
    const report = await discoverEmployers({dryRun: args.includes("--dry-run")});
    const json = JSON.stringify(report, null, 2);
    console.log(json);
    await writeFile("employer-discovery-report.json", json + "\n");
    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(process.env.GITHUB_STEP_SUMMARY, "### 招聘来源探测\n\n" + report.results.map(row => `- ${row.company}：${row.status}，${row.jobs} 个岗位${row.note ? `（${row.note}）` : ""}`).join("\n") + "\n");
    }
    if (!report.ok) process.exitCode = 1;
  } finally { await getPrisma().$disconnect(); }
}
main().catch(error => {console.error(error instanceof Error ? error.message : error); process.exitCode = 1;});
