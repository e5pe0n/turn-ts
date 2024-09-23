import { magicCookie } from "./consts.js";
import { type ValueOf, assertValueOf } from "./helpers.js";

export const classRecord = {
	request: 0b00,
	indication: 0b01,
	successResponse: 0b10,
	errorResponse: 0b11,
} as const;

export type Class = ValueOf<typeof classRecord>;

export const methodRecord = {
	binding: 0x0001,
} as const;

export type Method = ValueOf<typeof methodRecord>;

export type MsgType = {
	cls: Class;
	method: Method;
};

export type Header = {
	cls: Class;
	method: Method;
	length: number; // bytes
	magicCookie: typeof magicCookie;
	trxId: Buffer;
};

export function encodeMsgType({ cls, method }: MsgType): Buffer {
	const buf = Buffer.alloc(2);
	let n = 0;
	n |= method & 0b1111;
	if (cls & 0b01) {
		n |= 1 << 4;
	}
	n |= method & (0b111 << 5);
	if (cls & 0b10) {
		n |= 1 << 8;
	}
	n |= method & (0b11111 << 9);
	buf.writeUInt16BE(n);
	return buf;
}

export function decodeMsgType(n: number): MsgType {
	let m = 0;
	let c = 0;
	for (let i = 0, b = 1 << 13; i < 14; ++i, b >>>= 1) {
		if (n & b) {
			if (i === 5) {
				c += 2;
			} else if (i === 9) {
				c += 1;
			} else {
				m += b;
			}
		}
	}

	assertValueOf(
		m,
		methodRecord,
		new Error(`${m.toString(2)} is not a method.`),
	);
	assertValueOf(c, classRecord, new Error(`${c.toString(2)} is not a class.`));

	return { method: m, cls: c };
}

const exclusiveMaxStunMessageType = 1 << 14;

export function decodeHeader(buf: Buffer): Header {
	/**
	 *     0                   1                   2                   3
	 *     0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
	 *    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	 *    |0 0|     STUN Message Type     |         Message Length        |
	 *    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	 *    |                         Magic Cookie                          |
	 *    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	 *    |                                                               |
	 *    |                     Transaction ID (96 bits)                  |
	 *    |                                                               |
	 *    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	 */
	const fst16bits = buf.subarray(0, 2).readUint16BE();
	if (!(exclusiveMaxStunMessageType > fst16bits)) {
		throw new Error("first 2 bits must be zeros.");
	}
	const { method, cls } = decodeMsgType(fst16bits);
	const length = buf.subarray(2, 4).readInt16BE();
	const maybeMagicCookie = buf.subarray(4, 8).readInt32BE();
	if (maybeMagicCookie !== magicCookie) {
		throw new Error(
			`invalid magic cookie; magic cookie must be '${magicCookie}'. the given value is '0x${maybeMagicCookie.toString(16)}'`,
		);
	}
	const trxId = Buffer.alloc(12, buf.subarray(8, 20));
	return { method, cls, length, magicCookie, trxId };
}
