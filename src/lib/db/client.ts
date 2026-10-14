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

function createClient(): PrismaClient {
  const url = resolveDatabaseUrl();
  // SQLite is the local default. A postgres/postgresql URL uses the pg adapter.
  // The schema provider must match: change prisma/schema.prisma to "postgresql"
  // and run `npx prisma generate` before querying Neon. See README.
  const adapter = isPostgresUrl(url)
    ? new PrismaPg({ connectionString: url })
    : new PrismaBetterSqlite3({ url });

  return new PrismaClient({ adapter });
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}
