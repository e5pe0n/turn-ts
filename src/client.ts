import { randomBytes } from "node:crypto";
import { type Socket, createSocket } from "node:dgram";
import { compReqAttrTypeRecord } from "./attr.js";
import { classRecord, encodeHeader, methodRecord } from "./header.js";
import { fBuf } from "./helpers.js";
import { decodeStunMsg } from "./msg.js";
import type { Protocol } from "./types.js";

export type MessageClass = Extract<keyof typeof classRecord, "request">;
export type MessageMethod = keyof typeof methodRecord;

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

function decodeResponse(buf: Buffer, trxId: Buffer): Response {
	const {
		header: { trxId: resTrxId },
		attrs,
	} = decodeStunMsg(buf);
	if (!trxId.equals(resTrxId)) {
		throw new Error(
			`invalid transaction id; expected: ${trxId}, actual: ${resTrxId}.`,
		);
	}
	const { type, value } = attrs[0]!;
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
	#sock: Socket;

	constructor(config: ClientConfig) {
		this.#address = config.address;
		this.#port = config.port;
		this.#protocol = config.protocol;
		this.#sock = createSocket("udp4");
	}

	async req(cls: MessageClass, method: MessageMethod): Promise<Response> {
		const trxId = randomBytes(12);
		const hBuf = encodeHeader({
			cls: classRecord[cls],
			method: methodRecord[method],
			trxId,
			length: 0,
		});
		this.#sock.bind();
		return new Promise((resolve, reject) => {
			this.#sock.on("message", (msg) => {
				this.#sock.removeAllListeners("message");
				this.#sock.close();
				try {
					const res = decodeResponse(msg, trxId);
					resolve(res);
				} catch (err) {
					reject(err);
				}
			});
			this.#sock.send(hBuf, this.#port, this.#address, (err, bytes) => {
				if (err) {
					this.#sock.close();
					reject(err);
				}
			});
		});
	}
}
