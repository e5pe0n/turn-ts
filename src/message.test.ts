import { randomBytes } from "node:crypto";
import { describe, expect, it, test } from "vitest";
import {
	classRecord,
	methodRecord,
	decodeClassAndMethod,
	decodeHeader,
	type Header,
} from "./message.js";

describe("decodeClassAndMethod", () => {
	test.each([
		[
			{
				arg: 0b000000_00000001,
				expected: { method: methodRecord.binding, cls: classRecord.request },
				methodName: "Binding",
				className: "request",
			},
			{
				arg: 0b000001_00000001,
				expected: {
					method: methodRecord.binding,
					cls: classRecord.successResponse,
				},
				methodName: "Binding",
				className: "success response",
			},
			{
				arg: 0b000001_00010001,
				expected: {
					method: methodRecord.binding,
					cls: classRecord.errorResponse,
				},
				methodName: "Binding",
				className: "error response",
			},
		],
	])(
		"decodes a $methodName $className",
		({ arg, expected, methodName, className }) => {
			expect(decodeClassAndMethod(arg)).toEqual(expected);
		},
	);
	it("throws error if result is not a method", () => {
		const arg = 0x0000;
		expect(() => decodeClassAndMethod(arg)).toThrowError(/not a method/);
	});
});

describe("decodeHeader", () => {
	it("throws error if STUN message header does not begin with 0b00", () => {
		const trxId = randomBytes(6);
		const buf = Buffer.concat([
			Buffer.from([
				// STUN Message Type
				0b01_000000, // invalid first 2 bits
				0x01,
				0x00, // Message Length
				0x00,
				0x21, // Magic Cookie
				0x12,
				0xa4,
				0x41,
			]),
			trxId,
		]);
		expect(() => decodeHeader(buf)).toThrowError(/first 2 bits must be zeros/);
	});
	it("throws error if STUN message header does not include valid magic cookie", () => {
		const trxId = randomBytes(6);
		const buf = Buffer.concat([
			Buffer.from([
				0x00, // STUN Message Type
				0x01,
				0x10, // Message Length
				0x11,
				0x21, // Magic Cookie
				0x12,
				0xa4,
				0x41,
			]),
			trxId,
		]);
		expect(() => decodeHeader(buf)).toThrowError(/invalid magic cookie/);
	});
	it("decodes STUN message header", () => {
		const trxId = randomBytes(6);
		const buf = Buffer.concat([
			Buffer.from([
				0x00, // STUN Message Type
				0x01,
				0x10, // Message Length
				0x11,
				0x21, // Magic Cookie
				0x12,
				0xa4,
				0x42,
			]),
			trxId,
		]);
		const res = decodeHeader(buf);
		expect(res).toEqual({
			cls: classRecord.request,
			method: methodRecord.binding,
			length: 0x1011,
			magicCookie: 0x2112a442,
			trxId,
		} satisfies Header);
	});
});
