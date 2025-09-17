CREATE EXTENSION IF NOT EXISTS citext;
--> statement-breakpoint
CREATE TABLE "object_pieces" (
	"id" uuid PRIMARY KEY NOT NULL,
	"object_version_id" uuid NOT NULL,
	"upstream_file_id" uuid NOT NULL,
	"content_length" bigint NOT NULL,
	"object_offset" bigint NOT NULL,
	"upstream_offset" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "s3_buckets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" "citext" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "UQ_s3_buckets_name" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "s3_object_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"object_id" uuid NOT NULL,
	"content_length" bigint NOT NULL,
	"content_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"md5" "bytea" NOT NULL,
	CONSTRAINT "CHK_s3_object_versions_content_length" CHECK ("s3_object_versions"."content_length" >= -1)
);
--> statement-breakpoint
CREATE TABLE "s3_objects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"bucket_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"latest_version_id" uuid,
	CONSTRAINT "UQ_s3_objects_bucket_id_object_key" UNIQUE("bucket_id","object_key")
);
--> statement-breakpoint
CREATE TABLE "upstream_files" (
	"id" uuid PRIMARY KEY NOT NULL,
	"upstream_provider_id" text NOT NULL,
	"file_ref" text NOT NULL,
	"content_length" bigint NOT NULL,
	"parameters" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "object_pieces" ADD CONSTRAINT "object_pieces_object_version_id_s3_object_versions_id_fk" FOREIGN KEY ("object_version_id") REFERENCES "public"."s3_object_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_pieces" ADD CONSTRAINT "object_pieces_upstream_file_id_upstream_files_id_fk" FOREIGN KEY ("upstream_file_id") REFERENCES "public"."upstream_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "s3_object_versions" ADD CONSTRAINT "s3_object_versions_object_id_s3_objects_id_fk" FOREIGN KEY ("object_id") REFERENCES "public"."s3_objects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "s3_objects" ADD CONSTRAINT "s3_objects_bucket_id_s3_buckets_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "public"."s3_buckets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "s3_objects" ADD CONSTRAINT "s3_objects_latest_version_id_s3_object_versions_id_fk" FOREIGN KEY ("latest_version_id") REFERENCES "public"."s3_object_versions"("id") ON DELETE no action ON UPDATE no action;