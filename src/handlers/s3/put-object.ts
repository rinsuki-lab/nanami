import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { db } from "../../db/index.js";
import {
	objectPiecesTable,
	s3BucketsTable,
	s3ObjectsTable,
	s3ObjectVersionsTable,
	upstreamFilesTable,
} from "../../db/schema.js";
import { S3Error } from "../../utils/s3-error.js";
import { config } from "../../config-loader.js";

export async function handleS3PutObject(
	bucketName: string,
	key: string,
	body: ReadableStream<Uint8Array>,
	options: {
		contentType: string | undefined;
		contentLength: bigint;
	},
) {
	await db.transaction(async (tx) => {
		const bucket = await tx.query.s3BucketsTable.findFirst({
			where: eq(s3BucketsTable.name, bucketName),
		});
		if (bucket == null) {
			throw new S3Error(
				404,
				"NoSuchBucket",
				"The specified bucket does not exist",
			);
		}

		const objectIds = await tx
			.insert(s3ObjectsTable)
			.values({
				bucketId: bucket.id,
				objectKey: key,
				id: v7(),
			})
			.onConflictDoNothing({
				target: [s3ObjectsTable.bucketId, s3ObjectsTable.objectKey],
			})
			.returning({ id: s3ObjectsTable.id });

		const objectId =
			objectIds.at(0)?.id ??
			(await tx.query.s3ObjectsTable
				.findFirst({
					where: and(
						eq(s3ObjectsTable.bucketId, bucket.id),
						eq(s3ObjectsTable.objectKey, key),
					),
				})
				.then((r) => r?.id));
		if (objectId == null)
			throw new Error(`Failed to create (or find) s3Object`);

		const tonClient = config.backends[config.preferredBackend];
		if (tonClient == null) throw new Error("No TON client configured");
		let filled = 0;
		console.log(body);
		let length = 0n;
		const entireMd5 = createHash("md5");
		let uploadSession, buffer;
		for await (let chunk of body) {
			if (uploadSession == null && buffer == null) {
				uploadSession = await tonClient.uploadStart({
					fileSize: options.contentLength,
				});
				buffer = new Uint8Array(uploadSession.chunkSize);
			}
			if (uploadSession == null || buffer == null)
				throw new Error("Unreachable");
			length += BigInt(chunk.length);
			entireMd5.update(chunk);
			while (chunk.length > 0) {
				const shouldFill = Math.min(chunk.length, buffer.length - filled);
				buffer.set(chunk.subarray(0, shouldFill), filled);
				chunk = chunk.subarray(shouldFill);
				filled += shouldFill;
				if (filled === buffer.length) {
					await uploadSession.append(buffer);
					filled = 0;
				}
			}
		}
		if (filled) {
			if (uploadSession == null || buffer == null)
				throw new Error("Unreachable");
			const finalBuffer = buffer.subarray(0, filled);
			await uploadSession.append(finalBuffer);
		}

		const objectVersionId = await tx
			.insert(s3ObjectVersionsTable)
			.values({
				id: v7(),
				objectId,
				contentLength: length,
				contentType: options.contentType ?? "application/octet-stream",
				md5: entireMd5.digest(),
			})
			.returning({ id: s3ObjectVersionsTable.id })
			.then((r) => r[0]?.id);

		if (objectVersionId == null)
			throw new Error("Failed to create s3ObjectVersion");

		if (uploadSession != null) {
			const fileRef = await uploadSession.finalize({
				name: `${bucketName}/${key}`,
			});

			console.log("Uploaded to TON:", fileRef);

			const upstreamFileId = await tx
				.insert(upstreamFilesTable)
				.values({
					id: v7(),
					upstreamProviderId: tonClient.providerId,
					fileRef: fileRef,
					contentLength: length,
					parameters: {},
				})
				.returning({ id: upstreamFilesTable.id })
				.then((r) => r[0]?.id);
			if (upstreamFileId == null)
				throw new Error("Failed to create upstreamFile");

			for (const chunk of uploadSession.chunkInfos) {
				await tx.insert(objectPiecesTable).values({
					id: v7(),
					objectVersionId,
					upstreamFileId,
					contentLength: BigInt(chunk.length),
					objectOffset: 0n + chunk.start,
					upstreamOffset: chunk.start,
				});
			}
		} else {
			if (length !== 0n) {
				throw new Error("Unreachable: no uploadSession but length > 0");
			}
		}

		await tx
			.update(s3ObjectsTable)
			.set({
				latestVersionId: objectVersionId,
			})
			.where(eq(s3ObjectsTable.id, objectId));
	});
}
