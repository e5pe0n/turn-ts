import { describe, expect, it } from "vitest";
import { addrFamilyRecord, compReqAttrTypeRecord } from "./attr.js";
import { magicCookie } from "./consts.js";
import { classRecord, methodRecord } from "./header.js";
import { type StunMsg, decodeStunMsg, encodeStunMsg } from "./msg.js";

describe("decodeStunMsg", () => {
	it("throws an error if the STUN message is not >= 20 bytes", () => {
		const buf = Buffer.from([
			// 8 bytes
			0x00, // STUN Message Type
			0x01,
			0x00, // Message Length
			0x08,
			0x21, // Magic Cookie
			0x12,
			0xa4,
			0x42,
			// Trx Id (12 - 1 bytes)
			0x81,
			0x4c,
			0x72,
			0x09,
			0xa7,
			0x68,
			0xf9,
			0x89,
			0xf8,
			0x0b,
			0x73,
			// 0xbd		-1 byte
		]);
		expect(() => decodeStunMsg(buf)).toThrowError(/invalid header/);
	});
	it("decodes a STUN message", () => {
		const trxId = Buffer.from([
			0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
		]);
		const hBuf = Buffer.concat([
			Buffer.from([
				0x00, // STUN Message Type: Binding request
				0x01,
				0x00, // Message Length: 12 bytes
				0x0c,
				0x21, // Magic Cookie
				0x12,
				0xa4,
				0x42,
			]),
			trxId,
		]);
		const attrBuf = Buffer.from([
			0x00, // Attr Type: XOR-MAPPED-ADDRESS
			0x20,
			0x00, // Attr Length: 8 bytes
			0x08,
			// Attr Value
			0x00,
			0x01, // Family: IPv4
			0x10, // X-Port
			0x01,
			0xff, // X-Address (IPv4)
			0x2c,
			0x53,
			0x04,
		]); // 12 bytes
		const buf = Buffer.concat([hBuf, attrBuf]);
		expect(decodeStunMsg(buf)).toEqual({
			header: {
				cls: classRecord.request,
				method: methodRecord.binding,
				length: 12,
				magicCookie,
				trxId,
			},
			attrs: [
				{
					type: compReqAttrTypeRecord["XOR-MAPPED-ADDRESS"],
					length: 8,
					value: {
						family: addrFamilyRecord.ipV4,
						port: 0x3113,
						addr: Buffer.from([0xde, 0x3e, 0xf7, 0x46]),
					},
				},
			],
		} satisfies StunMsg);
	});
});

describe("encodeStunMsg", () => {
	it("encodes a STUN message", () => {
		const trxId = Buffer.from([
			0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
		]);
		const res = encodeStunMsg({
			header: {
				cls: classRecord.successResponse,
				method: methodRecord.binding,
				trxId,
			},
			attrs: [
				{
					type: compReqAttrTypeRecord["XOR-MAPPED-ADDRESS"],
					value: {
						family: addrFamilyRecord.ipV4,
						addr: Buffer.from([0xde, 0x3e, 0xf7, 0x46]),
						port: 12345,
					},
				},
			],
		});
		expect(res).toEqual(
			Buffer.concat([
				// Header
				Buffer.from([
					0b00_000001, // Message Type
					0b00000001,
					0x00, // Length: 12 bytes
					0x0c,
					0x21, // Magic Cookie
					0x12,
					0xa4,
					0x42,
				]),
				trxId,
				// Attrs
				Buffer.from([
					0x00, // Type
					0x20,
					0x00, // Length
					0x08,
					// Value
					0x00,
					0x01, // Family (IPv4)
					0x11, // Port
					0x2b,
					0xff, // X-Address (IPv4)
					0x2c,
					0x53,
					0x04,
				]),
			]),
		);
	});
});
