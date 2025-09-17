import { serve } from "@hono/node-server";
import { type Context, Hono } from "hono";
import { handleS3CreateBucket } from "./handlers/s3/create-bucket.js";
import { handleS3GetObject } from "./handlers/s3/get-object.js";
import { handleS3ListBuckets } from "./handlers/s3/list-buckets.js";
import { handleS3ListObjects } from "./handlers/s3/list-objects.js";
import { handleS3PutObject } from "./handlers/s3/put-object.js";
import { returnXML } from "./utils/return-xml.js";
import { returnS3Error, S3Error } from "./utils/s3-error.js";

const app = new Hono();

app.onError((err, c) => {
	if (err instanceof S3Error) {
		return returnS3Error(
			c,
			err.statusCode,
			err.errorCode,
			err.errorMessage,
			err.errorResource,
		);
	}
	console.error(err);
	return returnS3Error(c, 500, "InternalError", "", c.req.path);
});

app.get("/", async (c) => {
	return returnXML(c, await handleS3ListBuckets());
});

app.on("PUT", ["/:bucket", "/:bucket/"], async (c) => {
	const bucket = c.req.param("bucket");
	const res = await handleS3CreateBucket(bucket);

	return c.body(null, 200, {
		Location: "/" + bucket,
	});
});

app.on("GET", ["/:bucket", "/:bucket/"], async (c) => {
	const bucket = c.req.param("bucket");
	if (c.req.query("location") != null) {
		// GetBucketLocation
		throw new S3Error(
			501,
			"NotImplemented",
			"A header you provided implies functionality that is not implemented.",
		);
	}
	if (c.req.query("logging") != null) {
		// GetBucketLogging
		throw new S3Error(
			501,
			"NotImplemented",
			"A header you provided implies functionality that is not implemented.",
		);
	}
	if (c.req.query("lifecycle") != null) {
		// GetBucketLifecycleConfiguration
		throw new S3Error(
			501,
			"NotImplemented",
			"A header you provided implies functionality that is not implemented.",
		);
	}
	if (c.req.query("website") != null) {
		// GetBucketWebsite
		throw new S3Error(
			501,
			"NotImplemented",
			"A header you provided implies functionality that is not implemented.",
		);
	}
	if (c.req.query("acl") != null) {
		// GetBucketAcl
		throw new S3Error(
			501,
			"NotImplemented",
			"A header you provided implies functionality that is not implemented.",
		);
	}
	if (c.req.query("versioning") != null) {
		// GetBucketVersioning
		throw new S3Error(
			501,
			"NotImplemented",
			"A header you provided implies functionality that is not implemented.",
		);
	}
	if (c.req.query("ownershipControls") != null) {
		// GetBucketOwnershipControls
		throw new S3Error(
			501,
			"NotImplemented",
			"A header you provided implies functionality that is not implemented.",
		);
	}
	if (c.req.query("versions") != null) {
		// ListObjectVersions
		throw new S3Error(
			501,
			"NotImplemented",
			"A header you provided implies functionality that is not implemented.",
		);
	}
	if (c.req.query("uploads") != null) {
		// ListMultipartUploads
		throw new S3Error(
			501,
			"NotImplemented",
			"A header you provided implies functionality that is not implemented.",
		);
	}
	if (c.req.query("list-type") === "2") {
		// ListObjectsV2
		throw new S3Error(
			501,
			"NotImplemented",
			"A header you provided implies functionality that is not implemented.",
		);
	}
	// ListObjects (v1)
	return returnXML(
		c,
		await handleS3ListObjects(bucket, {
			prefix: c.req.query("prefix") ?? "",
			delimiter: c.req.query("delimiter"),
		}),
	);
});

app.get("/:bucket/:key{.+}", async (c) => {
	const bucket = c.req.param("bucket");
	const key = c.req.param("key");
	return await handleS3GetObject(
		bucket,
		key,
		{
			range: c.req.header("Range"),
		},
		c,
	);
});

app.put("/:bucket/:key{.+}", async (c) => {
	const bucket = c.req.param("bucket");
	const key = c.req.param("key");

	if (c.req.query("acl") != null) {
		// PutObjectAcl
		throw new S3Error(
			501,
			"NotImplemented",
			"A header you provided implies functionality that is not implemented.",
		);
	}

	if (c.req.query("legal-hold") != null) {
		// PutObjectLegalHold
		throw new S3Error(
			501,
			"NotImplemented",
			"A header you provided implies functionality that is not implemented.",
		);
	}

	if (c.req.query("retention") != null) {
		// PutObjectRetention
		throw new S3Error(
			501,
			"NotImplemented",
			"A header you provided implies functionality that is not implemented.",
		);
	}

	if (c.req.query("tagging") != null) {
		// PutObjectTagging
		throw new S3Error(
			501,
			"NotImplemented",
			"A header you provided implies functionality that is not implemented.",
		);
	}

	if (c.req.query("renameObject") != null) {
		// RenameObject
		throw new S3Error(
			501,
			"NotImplemented",
			"A header you provided implies functionality that is not implemented.",
		);
	}

	if (c.req.query("partNumber") != null) {
		// UploadPart or UploadPartCopy
		throw new S3Error(
			501,
			"NotImplemented",
			"A header you provided implies functionality that is not implemented.",
		);
	}

	if (c.req.header("x-amz-copy-source") != null) {
		// CopyObject
		throw new S3Error(
			501,
			"NotImplemented",
			"A header you provided implies functionality that is not implemented.",
		);
	}

	const stream = c.req.raw.body;
	if (stream == null) {
		throw new Error(`Request body is null`);
	}

	const contentLengthStr = c.req.header("Content-Length");
	if (contentLengthStr == null)
		throw new Error("content-length is not defined");

	await handleS3PutObject(bucket, key, stream, {
		contentType: c.req.header("Content-Type"),
		contentLength: BigInt(contentLengthStr),
	});
	return c.body(null, 200, {});
});

serve(app);
