import { v7 } from "uuid";
import { db } from "../../db/index.js";
import { s3BucketsTable } from "../../db/schema.js";

export async function handleS3CreateBucket(name: string) {
	const bucket = await db.insert(s3BucketsTable).values({
		id: v7(),
		name,
	});
}
