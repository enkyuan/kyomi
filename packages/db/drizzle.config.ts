import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ["../../apps/web/.env.local", "../../apps/web/.env", ".env.local", ".env"] });

if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL for Drizzle config");
}

export default defineConfig({
  out: "./drizzle",
  schema: "./src/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
