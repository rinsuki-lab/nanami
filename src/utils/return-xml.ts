import { XMLBuilder } from "fast-xml-parser";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export function returnXML(
	c: Context,
	obj: any,
	status: ContentfulStatusCode = 200,
) {
	const builder = new XMLBuilder({
		ignoreAttributes: false,
	});

	return c.text(
		builder.build({
			"?xml": {
				"@_version": "1.0",
				"@_encoding": "UTF-8",
			},
			...obj,
		}),
		status,
		{
			"Content-Type": "application/xml",
		},
	);
}
