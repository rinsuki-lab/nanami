import { and, eq, inArray } from "drizzle-orm";
import type { Context } from "hono";
import { stream } from "hono/streaming";
import { db } from "../../db/index.js";
import {
	objectPiecesTable,
	s3BucketsTable,
	s3ObjectsTable,
	s3ObjectVersionsTable,
	upstreamFilesTable,
} from "../../db/schema.js";
import { type TONClient } from "../../ton-client.js";
import { BigIntMath } from "../../utils/bigint-math.js";
import { S3Error } from "../../utils/s3-error.js";
import { config } from "../../config-loader.js";

export async function handleS3GetObject(
	bucketName: string,
	key: string,
	params: {
		range: string | undefined;
	},
	c: Context,
) {
	const parsedRangeHeader =
		params.range != null
			? /^bytes=([0-9]+)-([0-9]+)?(?:\/([0-9]+))?$/.exec(params.range)
			: undefined;

	const bucket = await db.query.s3BucketsTable.findFirst({
		where: eq(s3BucketsTable.name, bucketName),
	});
	if (bucket == null) {
		throw new S3Error(
			404,
			"NoSuchBucket",
			"The specified bucket does not exist",
		);
	}

	const object = await db.query.s3ObjectsTable.findFirst({
		where: and(
			eq(s3ObjectsTable.bucketId, bucket.id),
			eq(s3ObjectsTable.objectKey, key),
		),
	});

	if (object?.latestVersionId == null) {
		throw new S3Error(404, "NoSuchKey", "The specified key does not exist.");
	}

	const objectVersion = await db.query.s3ObjectVersionsTable.findFirst({
		where: and(eq(s3ObjectVersionsTable.id, object.latestVersionId)),
	});

	if (objectVersion == null) {
		throw new S3Error(404, "NoSuchKey", "The specified key does not exist.");
	}

	if (objectVersion.contentLength < 0n) {
		// TODO: set delete marker header
		throw new S3Error(404, "NoSuchKey", "The specified key does not exist.");
	}

	const currentlyAvailableBackends: Record<string, TONClient> = config.backends;

	const pieces = await db
		.select()
		.from(objectPiecesTable)
		.innerJoin(
			upstreamFilesTable,
			eq(upstreamFilesTable.id, objectPiecesTable.upstreamFileId),
		)
		.where(
			and(
				eq(objectPiecesTable.objectVersionId, objectVersion.id),
				inArray(
					upstreamFilesTable.upstreamProviderId,
					Object.keys(currentlyAvailableBackends),
				),
			),
		);

	const start =
		parsedRangeHeader != null ? BigInt(parsedRangeHeader[1] ?? "0") : 0n;
	const end =
		parsedRangeHeader != null
			? BigIntMath.min(
					BigInt(parsedRangeHeader[2] ?? objectVersion.contentLength - 1n) + 1n,
					objectVersion.contentLength,
				)
			: objectVersion.contentLength;
	if (start > end) {
		throw new S3Error(416, "InvalidRange", "end is bigger than start");
	}

	let currentPtr = start;

	if (parsedRangeHeader != null) {
		c.status(206);
	} else {
		c.status(200);
	}
	const response = stream(
		c,
		async (stream) => {
			let shouldStop = false;
			stream.onAbort(() => {
				shouldStop = true;
			});
			const shouldSkipPieceIds = new Set();
			while (currentPtr < end && !shouldStop) {
				const piece = pieces.find(
					(p) =>
						p.object_pieces.objectOffset <= currentPtr &&
						p.object_pieces.objectOffset + p.object_pieces.contentLength >
							currentPtr &&
						!shouldSkipPieceIds.has(p.object_pieces.id),
				);
				if (piece == null) {
					throw new Error(
						`We couldn't find a piece for offset ${currentPtr} in object version ${objectVersion.id} (user wants ${start}-${end}/${objectVersion.contentLength})`,
					);
				}
				const backend =
					currentlyAvailableBackends[piece.upstream_files.upstreamProviderId];
				if (backend == null) {
					throw new Error(
						`Should never happen: we have a piece for provider ${piece.upstream_files.upstreamProviderId} but no backend`,
					);
				}
				const rawChunk = await backend.readFile(
					piece.upstream_files.fileRef,
					piece.object_pieces.upstreamOffset,
					BigIntMath.min(
						piece.object_pieces.contentLength,
						end - piece.object_pieces.objectOffset,
					),
				);
				const chunk = rawChunk.subarray(
					Number(currentPtr - piece.object_pieces.objectOffset),
				);
				if (chunk.length === 0) {
					shouldSkipPieceIds.add(piece.object_pieces.id);
				}
				await stream.write(chunk);
				currentPtr += BigInt(chunk.length);
			}
		},
		async (err, stream) => {
			console.error(err);
			stream.abort();
			stream.close();
		},
	);
	if (parsedRangeHeader != null) {
		response.headers.set(
			"Content-Range",
			`bytes ${start}-${end - 1n}/${objectVersion.contentLength}`,
		);
	}
	response.headers.set("Accept-Ranges", "bytes");
	response.headers.set("Content-Type", objectVersion.contentType);
	response.headers.set("Content-Length", (end - start).toString());
	response.headers.set("ETag", `"${objectVersion.md5.toString("hex")}"`);

	return response;
}
