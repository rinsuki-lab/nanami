import { sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	bigint,
	check,
	customType,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";

export const citext = customType<{ data: string }>({
	dataType() {
		return "citext";
	},
});

export const bytea = customType<{ data: Buffer }>({
	dataType() {
		return "bytea";
	},
});

export const s3BucketsTable = pgTable("s3_buckets", {
	id: uuid().notNull().primaryKey(),
	name: citext().notNull().unique("UQ_s3_buckets_name"),
	createdAt: timestamp({ mode: "date", withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const s3ObjectsTable = pgTable(
	"s3_objects",
	{
		id: uuid().notNull().primaryKey(),
		bucketId: uuid()
			.notNull()
			.references(() => s3BucketsTable.id),
		objectKey: text().notNull(),
		latestVersionId: uuid().references(
			(): AnyPgColumn => s3ObjectVersionsTable.id,
		),
	},
	(table) => [
		unique("UQ_s3_objects_bucket_id_object_key").on(
			table.bucketId,
			table.objectKey,
		),
	],
);

export const s3ObjectVersionsTable = pgTable(
	"s3_object_versions",
	{
		id: uuid().notNull().primaryKey(),
		objectId: uuid()
			.notNull()
			.references(() => s3ObjectsTable.id),
		contentLength: bigint({ mode: "bigint" }).notNull(),
		contentType: text().notNull(),
		createdAt: timestamp({ mode: "date", withTimezone: true })
			.notNull()
			.defaultNow(),
		md5: bytea({ length: 16 }).notNull(),
	},
	(table) => [
		check(
			"CHK_s3_object_versions_content_length",
			sql`${table.contentLength} >= -1`,
		), // -1 means delete marker
	],
);

export const upstreamFilesTable = pgTable("upstream_files", {
	id: uuid().notNull().primaryKey(),
	upstreamProviderId: text().notNull(),
	fileRef: text().notNull(),
	contentLength: bigint({ mode: "bigint" }).notNull(),
	parameters: jsonb().notNull(),
});

export const objectPiecesTable = pgTable("object_pieces", {
	id: uuid().primaryKey(),
	objectVersionId: uuid()
		.notNull()
		.references(() => s3ObjectVersionsTable.id),
	upstreamFileId: uuid()
		.notNull()
		.references(() => upstreamFilesTable.id),
	contentLength: bigint({ mode: "bigint" }).notNull(),
	objectOffset: bigint({ mode: "bigint" }).notNull(),
	upstreamOffset: bigint({ mode: "bigint" }).notNull(),
});
