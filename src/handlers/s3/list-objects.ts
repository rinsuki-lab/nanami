import { and, eq, like, not, notLike, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
	s3BucketsTable,
	s3ObjectsTable,
	s3ObjectVersionsTable,
} from "../../db/schema.js";
import { escapeForLike } from "../../utils/escape-for-like.js";

export async function handleS3ListObjects(
	bucketName: string,
	options: {
		prefix: string;
		delimiter: string | undefined;
		encodingType?: "url";
		marker?: string;
		maxKeys?: number;
	},
) {
	const bucket = await db.query.s3BucketsTable.findFirst({
		where: eq(s3BucketsTable.name, bucketName),
	});
	if (bucket == null) {
		return;
	}
	const objects = await db
		.select()
		.from(s3ObjectsTable)
		.innerJoin(
			s3ObjectVersionsTable,
			eq(s3ObjectsTable.latestVersionId, s3ObjectVersionsTable.id),
		)
		.where(
			and(
				eq(s3ObjectsTable.bucketId, bucket.id),
				not(eq(s3ObjectVersionsTable.contentLength, -1n)),
				options.delimiter != null
					? notLike(
							s3ObjectsTable.objectKey,
							escapeForLike(options.prefix) +
								"%" +
								escapeForLike(options.delimiter) +
								"%",
						)
					: undefined,
				options.prefix.length
					? like(s3ObjectsTable.objectKey, escapeForLike(options.prefix) + "%")
					: undefined,
			),
		)
		.orderBy(s3ObjectsTable.objectKey);

	const commonPrefixes =
		options.delimiter == null
			? []
			: await db
					.select({
						Prefix: sql<string>`substr(
							${s3ObjectsTable.objectKey},
							0,
							strpos(
								substr(
									${s3ObjectsTable.objectKey},
									char_length(${options.prefix}) + 1
								),
								${options.delimiter}
							)
							+char_length(${options.prefix})
							+char_length(${options.delimiter})
						) AS Prefix`,
					})
					.from(s3ObjectsTable)
					.innerJoin(
						s3ObjectVersionsTable,
						eq(s3ObjectsTable.latestVersionId, s3ObjectVersionsTable.id),
					)
					.where(
						and(
							eq(s3ObjectsTable.bucketId, bucket.id),
							not(eq(s3ObjectVersionsTable.contentLength, -1n)),
							like(
								s3ObjectsTable.objectKey,
								escapeForLike(options.prefix) +
									"%" +
									escapeForLike(options.delimiter) +
									"%",
							),
						),
					)
					.groupBy(sql`Prefix`);
	return {
		ListBucketResult: {
			Name: bucket.name,
			Prefix: options.prefix,
			Delimiter: options.delimiter,
			Contents: objects.map((obj) => ({
				Key: obj.s3_objects.objectKey,
				LastModified: obj.s3_object_versions.createdAt.toISOString(),
				Size: obj.s3_object_versions.contentLength.toString(),
				ETag: '"' + obj.s3_object_versions.md5.toString("hex") + '"',
			})),
			CommonPrefixes: commonPrefixes,
			IsTruncated: false,
		},
	};
}
