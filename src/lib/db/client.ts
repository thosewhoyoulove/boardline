import { copyFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function resolveDatabaseUrl(): string {
  return process.env.DATABASE_URL?.trim() || "file:./dev.db";
}

export function isPostgresUrl(url: string): boolean {
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}

function sqliteUrlForRuntime(url: string): string {
  // `vercel deploy` sets VERCEL while it builds locally. Read the project database
  // during that build. /tmp is only for the read-only serverless filesystem.
  if (!process.env.VERCEL || process.env.NEXT_PHASE === "phase-production-build") return url;

  const target = "/tmp/boardline.db";
  const source = [path.join(process.cwd(), "dev.db"), path.join(process.cwd(), "prisma", "dev.db")].find((candidate) =>
    existsSync(candidate),
  );
  if (!source) {
    throw new Error("Vercel 函数里没有找到 dev.db 职位快照");
  }
  if (!existsSync(target) || statSync(source).mtimeMs > statSync(target).mtimeMs) {
    copyFileSync(source, target);
  }
  return "file:/tmp/boardline.db";
}

function createClient(): PrismaClient {
  const url = resolveDatabaseUrl();
  // SQLite is the local default. A postgres/postgresql URL uses the pg adapter.
  // The schema provider must match: change prisma/schema.prisma to "postgresql"
  // and run `npx prisma generate` before querying Neon. See README.
  const adapter = isPostgresUrl(url)
    ? new PrismaPg({ connectionString: url })
    : new PrismaBetterSqlite3({ url: sqliteUrlForRuntime(url) });

  return new PrismaClient({ adapter });
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}
