import "dotenv/config";
import { defineConfig, env } from "prisma/config";

interface Env {
  DATABASE_URL: string;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env<Env>("DATABASE_URL"),
  },
});
