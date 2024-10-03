import { randomBytes } from "node:crypto";
import {
	classRecord,
	encodeHeader,
	encodeMsgType,
	methodRecord,
} from "./header.js";
import { fBuf } from "./helpers.js";
import { createSocket, type Socket } from "node:dgram";
import { decodeStunMsg } from "./msg.js";
import { compReqAttrTypeRecord, type XorMappedAddressAttr } from "./attr.js";

export type MessageClass = Extract<keyof typeof classRecord, "request">;
export type MessageMethod = keyof typeof methodRecord;
export type Protocol = "udp" | "tcp";

export type ErrorResponse = {
	success: false;
	code: number;
	reason: string;
};

export type SuccessResponse = {
	success: true;
	address: string; // Reflexive Transport Address
	port: number;
};

export type Response = SuccessResponse | ErrorResponse;

export type ClientConfig = {
	address: string;
	port: number;
	protocol: Protocol;
};

function fAddr(buf: Buffer): string {
	return Array.from(buf.values()).map(String).join(".");
}

function decodeResponse(buf: Buffer): Response {
	const msg = decodeStunMsg(buf);
	const { type, value } = msg.attrs[0]!;
	switch (type) {
		case compReqAttrTypeRecord["XOR-MAPPED-ADDRESS"]:
			return {
				success: true,
				port: value.port,
				address: fAddr(value.addr),
			};
		case compReqAttrTypeRecord["ERROR-CODE"]:
			return {
				success: false,
				code: value.code,
				reason: value.reason,
			};
		default:
			throw new Error(`invalid attr type: ${type} is not supported.`);
	}
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
			length: 0,
		});
		return new Promise((resolve, reject) => {
			this.#sock.on("message", (msg) => {
				this.#sock.removeAllListeners("message");
				const res = decodeResponse(msg);
				resolve(res);
			});
			this.#sock.send(hBuf, this.#port, this.#address, (err, bytes) => {
				if (err) {
					reject(err);
				}
			});
		});
	}
}
