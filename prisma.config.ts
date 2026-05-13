import "dotenv/config";
import { defineConfig } from "prisma/config";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "bun run prisma/seed.ts"
  },
  datasource: {
    url: requireEnv("DIRECT_DATABASE_URL")
  }
});
