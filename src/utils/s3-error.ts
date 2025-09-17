import { XMLBuilder } from "fast-xml-parser";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export function returnS3Error(
	c: Context,
	http: ContentfulStatusCode,
	code: string,
	message: string,
	resource?: string,
) {
	const requestId = c.req.header("x-request-id");
	const builder = new XMLBuilder();

	return new Response(
		builder.build({
			Error: {
				Code: code,
				Message: message,
				Resource: resource,
				RequestId: requestId,
			},
		}),
		{
			status: http,
			headers: {
				"Content-Type": "application/xml",
			},
		},
	);
}

export class S3Error extends Error {
	constructor(
		public statusCode: ContentfulStatusCode,
		public errorCode: string,
		public errorMessage: string,
		public errorResource?: string,
	) {
		super(`${errorCode} (${statusCode}): ${errorMessage}`);
	}
}
