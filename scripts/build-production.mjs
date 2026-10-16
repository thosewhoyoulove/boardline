import { spawnSync } from "node:child_process";

if (!/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL?.trim() ?? "")) {
  throw new Error("Production requires a persistent PostgreSQL DATABASE_URL. Configure it in Vercel before deploying.");
}

for (const [cli, ...args] of [
  ["node_modules/prisma/build/index.js", "generate"],
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  ["node_modules/next/dist/bin/next", "build"],
]) {
  const result = spawnSync(process.execPath, [cli, ...args], { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
