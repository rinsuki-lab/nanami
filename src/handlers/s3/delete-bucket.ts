import { DrizzleQueryError, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { s3BucketsTable } from "../../db/schema.js";
import { S3Error } from "../../utils/s3-error.js";

export async function handleS3DeleteBucket(name: string) {
    try {
        await db.delete(s3BucketsTable).where(eq(s3BucketsTable.name, name));
    } catch(e) {
        if (e instanceof DrizzleQueryError && e.cause instanceof Error) {
            if ("constraint" in e.cause && e.cause.constraint === "s3_objects_bucket_id_s3_buckets_id_fk") {
                throw new S3Error(409, "BucketNotEmpty", "The bucket you tried to delete is not empty", `/${name}`);
            }
        }
        throw new Error("Failed to delete bucket", { cause: e });
    }
}