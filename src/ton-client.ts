import { createHash } from "node:crypto";
import z from "zod/v4";

const USER_AGENT = "nanami/0.0.0-dev";

export class TONPleaseUpdateReferenceError extends Error {
	constructor(
		public oldRef: string,
		newRef: string,
	) {
		super(`The reference ${oldRef} is outdated, please update to ${newRef}`);
	}
}

export class TONClient {
	constructor(public providerId: string, public baseURL: string) {}

	async uploadStart(params: { fileSize: bigint }) {
		const url = new URL(this.baseURL + "/v1/upload/start");
		if (params.fileSize != null) {
			url.searchParams.set("file_size", params.fileSize.toString());
		}
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"User-Agent": USER_AGENT,
			},
		});
		if (!res.ok) {
			throw new Error(
				`Failed to start upload: ${res.status} ${await res.text()}`,
			);
		}
		const jsonRaw = await res.json();
		const json = z
			.object({
				token: z.string(),
				chunk_size: z.number().int(),
			})
			.parse(jsonRaw);

		return new TONUploadSession(this, json.token, json.chunk_size);
	}

	async readFile(ref: string, offset: bigint, length: bigint) {
		const url = new URL(
			this.baseURL + "/v1/files/" + ref + "/chunks/" + offset,
		);
		const res = await fetch(url, {
			headers: {
				"User-Agent": USER_AGENT,
			},
		});

		if (res.status === 409) {
			const newRef = res.headers.get("X-New-Ref");
			if (newRef != null) {
				throw new TONPleaseUpdateReferenceError(ref, newRef);
			}
		}

		if (!res.ok) {
			throw new Error(
				`Failed to read file chunk: ${res.status} ${await res.text()}`,
			);
		}

		// TODO: use stream
		const arrayBuffer = await res.arrayBuffer();
		return new Uint8Array(
			arrayBuffer,
			0,
			Math.min(arrayBuffer.byteLength, Number(length)),
		);
	}
}

class TONUploadSession {
	offset: bigint = 0n;
	hash = createHash("md5");
	chunkInfos: {
		start: bigint;
		length: number;
		md5: Buffer;
	}[] = [];

	constructor(
		public client: TONClient,
		public uploadToken: string,
		public chunkSize: number,
	) {}

	async append(content: Uint8Array<ArrayBuffer>) {
		this.chunkInfos.push({
			start: this.offset,
			length: content.length,
			md5: createHash("md5").update(content).digest(),
		});
		const url = new URL(this.client.baseURL + "/v1/upload/chunk");
		url.searchParams.set("token", this.uploadToken);
		url.searchParams.set("offset", this.offset.toString());
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"User-Agent": USER_AGENT,
				"Content-Type": "application/octet-stream",
			},
			body: content,
		});
		if (!res.ok) {
			throw new Error(
				`Failed to upload chunk (${this.offset}-): ${res.status} ${await res.text()}`,
			);
		}
		this.offset += BigInt(content.byteLength);
		this.hash.update(content);
		return;
	}

	async finalize(params: { name: string }) {
		const url = new URL(this.client.baseURL + "/v1/upload/finalize");
		url.searchParams.set("token", this.uploadToken);
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"User-Agent": USER_AGENT,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				name: params.name,
				md5: this.hash.digest("hex"),
			}),
		});
		if (!res.ok) {
			throw new Error(
				`Failed to finalize upload: ${res.status} ${await res.text()}`,
			);
		}
		const jsonRaw = await res.json();
		const json = z
			.object({
				ref: z.string(),
			})
			.parse(jsonRaw);

		return json.ref;
	}
}
