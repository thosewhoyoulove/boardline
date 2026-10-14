import "dotenv/config";
import { defineConfig } from "prisma/config";

// Zero-config local default. Override with a Neon/Postgres URL in the environment.
const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
