import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: process.env.NODE_ENV === "production" ? './dist/db/schema.js' : './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  casing: 'snake_case',
});