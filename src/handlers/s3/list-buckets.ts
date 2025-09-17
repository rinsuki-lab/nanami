import { db } from "../../db/index.js";
import { s3BucketsTable } from "../../db/schema.js";

export async function handleS3ListBuckets() {
	const buckets = await db.select().from(s3BucketsTable);

	return {
		ListAllMyBucketsResult: {
			Buckets: {
				Bucket: buckets.map((bucket) => ({
					Name: bucket.name,
					CreationDate: bucket.createdAt.toISOString(),
				})),
			},
		},
	};
}
