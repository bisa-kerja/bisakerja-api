import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl =
  process.env.DIRECT_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://app_user:replace-with-password@ep-local-breeze-a1b2c3d4.ap-southeast-1.aws.neon.tech/bisakerja_api?sslmode=require&channel_binding=require";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "bun run prisma/seed.ts"
  },
  datasource: {
    url: databaseUrl
  }
});
