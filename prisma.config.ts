import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const postgres = /^postgres(ql)?:\/\//.test(databaseUrl);

export default defineConfig({
  schema: postgres ? "prisma/postgres/schema.prisma" : "prisma/schema.prisma",
  migrations: {
    path: postgres ? "prisma/postgres/migrations" : "prisma/migrations",
  },
  datasource: {
    url: postgres ? process.env.DATABASE_DIRECT_URL || databaseUrl : databaseUrl,
  },
});
