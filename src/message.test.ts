import { describe, expect, it, test } from "vitest";
import { range } from "./helpers.js";
import { readClassAndMethod, readHeader, type Header } from "./message.js";

describe("readClassAndMethod", () => {
	test.each([
		[
			{
				arg: 0b000000_00000001,
				expected: { method: 0x0001, cls: 0b00 },
				methodName: "Binding",
				className: "request",
			},
			{
				arg: 0b000001_00000001,
				expected: { method: 0x0001, cls: 0b10 },
				methodName: "Binding",
				className: "success response",
			},
			{
				arg: 0b000001_00010001,
				expected: { method: 0x0001, cls: 0b11 },
				methodName: "Binding",
				className: "error response",
			},
		],
	])(
		"reads a $methodName $className",
		({ arg, expected, methodName, className }) => {
			expect(readClassAndMethod(arg)).toEqual(expected);
		},
	);
	it("throws error if result is not a method", () => {
		const arg = 0x0000;
		expect(() => readClassAndMethod(arg)).toThrowError(/not a method/);
	});
});

describe("readHeader", () => {
	it("throws error if STUN message header does not begin with 0b00", () => {
		const buf = Buffer.from([
			// STUN Message Type
			0b01_000000, // invalid first 2 bits
			0x01,
			0x00, // Message Length
			0x00,
			0x00, // Magic Cookie
			// Transaction ID
			...range(6).flatMap(() => [0x00]),
		]);
		expect(() => readHeader(buf)).toThrowError(/first 2 bits must be zeros/);
	});
	it("reads STUN message header", () => {
		const buf = Buffer.from([
			0x00, // STUN Message Type
			0x01,
			0x00, // Message Length
			0x00,
			0x00, // Magic Cookie
			// Transaction ID
			...range(6).flatMap(() => [0x00]),
		]);
		const res = readHeader(buf);
		expect(res).toMatchObject({
			cls: 0b00, // request
			method: 0x0001, // Binding
		} satisfies Header);
	});
});
