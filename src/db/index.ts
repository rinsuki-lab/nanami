import { drizzle } from "drizzle-orm/node-postgres";

export const db = drizzle(process.env.DATABASE_URL!, {
	casing: "snake_case",
	schema: await import("./schema.js"),
	logger: true,
});
