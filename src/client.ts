import { randomBytes } from "node:crypto";
import {
	classRecord,
	encodeHeader,
	encodeMsgType,
	methodRecord,
} from "./header.js";
import { fBuf } from "./helpers.js";
import { createSocket, type Socket } from "node:dgram";

export type MessageClass = Extract<keyof typeof classRecord, "request">;
export type MessageMethod = keyof typeof methodRecord;
export type Protocol = "udp" | "tcp";

export type Response = {
	address: string; // Reflexive Transport Address
};

export type ClientConfig = {
	address: string;
	port: number;
	protocol: Protocol;
};

function decodeSuccessResponse(buf: Buffer): string {
	if (buf.length !== 4) {
		throw new Error("invalid success response;");
	}
	return Array.from(buf.values()).map(String).join(".");
}

export class Client {
	#address: string;
	#port: number;
	#protocol: Protocol;
	#trxMap: Map<string, Buffer> = new Map();
	#sock: Socket;

	constructor(config: ClientConfig) {
		this.#address = config.address;
		this.#port = config.port;
		this.#protocol = config.protocol;
		this.#sock = createSocket("udp4");
		this.#sock.bind();
	}

	async req(cls: MessageClass, method: MessageMethod): Promise<Response> {
		const trxId = randomBytes(12);
		this.#trxMap.set(fBuf(trxId), trxId);
		const hBuf = encodeHeader({
			cls: classRecord[cls],
			method: methodRecord[method],
			trxId: randomBytes(12),
			length: 20,
		});
		return new Promise((resolve, reject) => {
			this.#sock.on("message", (msg) => {
				this.#sock.removeAllListeners("message");
				resolve({ address: decodeSuccessResponse(msg) });
			});
			this.#sock.send(hBuf, this.#port, this.#address, (err) => {
				reject(err);
			});
		});
	}
}
