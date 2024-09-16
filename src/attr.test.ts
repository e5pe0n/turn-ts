import { describe, expect, it } from "vitest";
import { readMappedAddressValue, type MappedAddressAttr } from "./attr.js";

describe("readMappedAddressValue", () => {
	it("throws an error if an invalid address family given", () => {
		const buf = Buffer.from([
			0x00,
			0x00, // invalid Family
			0x10, // Port
			0x01,
			0x10, // Address (IPv4)
			0x11,
			0x00,
			0x01,
		]);
		expect(() => readMappedAddressValue(buf)).toThrowError(
			/invalid address family/,
		);
	});
	it("reads IPv4 MAPPED-ADDRESS value", () => {
		const buf = Buffer.from([
			0x00,
			0x01, // Family: IPv4
			0x10, // Port
			0x01,
			0x10, // Address (32 bits)
			0x11,
			0x00,
			0x01,
		]);
		expect(readMappedAddressValue(buf)).toEqual({
			family: 0x01,
			port: 0x1001,
			addr: new Uint8Array([0x10, 0x11, 0x00, 0x01]),
		} satisfies MappedAddressAttr["value"]);
	});
	it("reads IPv6 MAPPED-ADDRESS value", () => {
		const buf = Buffer.from([
			0x00,
			0x02, // Family: IPv4
			0x10, // Port
			0x01,
			0x10, // Address (128 bits)
			0x11,
			0x00,
			0x01,

			0x10,
			0x11,
			0x00,
			0x01,

			0x10,
			0x11,
			0x00,
			0x01,

			0x10,
			0x11,
			0x00,
			0x01,
		]);
		expect(readMappedAddressValue(buf)).toEqual({
			family: 0x02,
			port: 0x1001,
			addr: new Uint8Array([
				0x10, 0x11, 0x00, 0x01, 0x10, 0x11, 0x00, 0x01, 0x10, 0x11, 0x00, 0x01,
				0x10, 0x11, 0x00, 0x01,
			]),
		} satisfies MappedAddressAttr["value"]);
	});
});
