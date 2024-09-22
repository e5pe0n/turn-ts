import { describe, expect, it } from "vitest";
import {
	type MappedAddressAttr,
	type XorMappedAddressAttr,
	addrFamilyRecord,
	compReqAttrTypeRecord,
	decodeMappedAddressValue,
	decodeXorMappedAddressValue,
	encodeMappedAddressValue,
} from "./attr.js";
import { magicCookie } from "./consts.js";
import { type Header, classRecord, methodRecord } from "./header.js";

describe("encodeMappedAddressValue", () => {
	it("encodes IPv4 MAPPED-ADDRESS attr", () => {
		const attr: MappedAddressAttr = {
			type: compReqAttrTypeRecord["MAPPED-ADDRESS"],
			length: 8,
			value: {
				family: addrFamilyRecord.ipV4,
				port: 12345,
				addr: Buffer.from([0xc9, 0xc7, 0xc5, 0x59]),
			},
		};
		expect(encodeMappedAddressValue(attr)).toEqual(
			Buffer.from([
				0x00, // Attr Type
				0x01,
				0x00, // Attr Length
				0x08,
				// Attr Value
				0x00,
				0x01, // Family (IPv4)
				0x30, // Port
				0x39,
				0xc9, // Address
				0xc7,
				0xc5,
				0x59,
			]),
		);
	});
	it("encodes IPv6 MAPPED-ADDRESS attr", () => {
		const attr: MappedAddressAttr = {
			type: compReqAttrTypeRecord["MAPPED-ADDRESS"],
			length: 20,
			value: {
				family: addrFamilyRecord.ipV6,
				port: 12345,
				addr: Buffer.from([
					0xde, 0x3e, 0xf7, 0x46, 0x70, 0x0f, 0x21, 0xb2, 0x0f, 0xf4, 0xf4,
					0x2e, 0x93, 0x47, 0x61, 0x2c,
				]),
			},
		};
		expect(encodeMappedAddressValue(attr)).toEqual(
			Buffer.from([
				0x00, // Attr Type
				0x01,
				0x00, // Attr Length
				0x14,
				// Attr Value
				0x00,
				0x02, // Family (IPv6)
				0x30, // Port
				0x39,
				0xde, //  Address
				0x3e,
				0xf7,
				0x46,
				0x70,
				0x0f,
				0x21,
				0xb2,
				0x0f,
				0xf4,
				0xf4,
				0x2e,
				0x93,
				0x47,
				0x61,
				0x2c,
			]),
		);
	});
});
describe("decodeMappedAddressValue", () => {
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
		expect(() => decodeMappedAddressValue(buf)).toThrowError(
			/invalid address family/,
		);
	});
	it("decodes IPv4 MAPPED-ADDRESS value", () => {
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
		expect(decodeMappedAddressValue(buf)).toEqual({
			family: 0x01,
			port: 0x1001,
			addr: Buffer.from([0x10, 0x11, 0x00, 0x01]),
		} satisfies MappedAddressAttr["value"]);
	});
	it("decodes IPv6 MAPPED-ADDRESS value", () => {
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
		expect(decodeMappedAddressValue(buf)).toEqual({
			family: 0x02,
			port: 0x1001,
			addr: Buffer.from([
				0x10, 0x11, 0x00, 0x01, 0x10, 0x11, 0x00, 0x01, 0x10, 0x11, 0x00, 0x01,
				0x10, 0x11, 0x00, 0x01,
			]),
		} satisfies MappedAddressAttr["value"]);
	});
});

describe("decodeXorMappedAddressValue", () => {
	it("throws an error if an invalid address family given", () => {
		const header: Header = {
			cls: classRecord.request,
			method: methodRecord.binding,
			length: 8, // bytes
			magicCookie,
			trxId: Buffer.from([
				0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
			]),
		};
		const buf = Buffer.from([
			0x00,
			0x00, // invalid Family
			0x10, // X-Port
			0x01,
			0x10, // X-Address (IPv4)
			0x11,
			0x00,
			0x01,
		]);
		expect(() => decodeXorMappedAddressValue(buf, header)).toThrowError(
			/invalid address family/,
		);
	});
	it("decodes IPv4 XOR-MAPPED-ADDRESS value", () => {
		const header: Header = {
			cls: classRecord.request,
			method: methodRecord.binding,
			length: 8, // bytes
			magicCookie,
			trxId: Buffer.from([
				0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
			]),
		};
		const buf = Buffer.from([
			0x00,
			0x01, // Family: IPv4
			0x10, // X-Port
			0x01,

			0xff, // X-Address (IPv4)
			0x2c,
			0x53,
			0x04,
		]);
		expect(decodeXorMappedAddressValue(buf, header)).toEqual({
			family: 0x01,
			port: 0x3113,
			addr: Buffer.from([0xde, 0x3e, 0xf7, 0x46]),
		} satisfies XorMappedAddressAttr["value"]);
	});
	it("decodes IPv7 XOR-MAPPED-ADDRESS value", () => {
		const header: Header = {
			cls: classRecord.request,
			method: methodRecord.binding,
			length: 20, // bytes
			magicCookie,
			trxId: Buffer.from([
				0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
			]),
		};
		const buf = Buffer.from([
			0x00,
			0x02, // Family: IPv6
			0x10, // X-Port
			0x01,

			0xff, // X-Address (IPv6)
			0x2c,
			0x53,
			0x04,

			0xf1,
			0x43,
			0x53,
			0xbb,

			0xa8,
			0x9c,
			0x0d,
			0xa7,

			0x6b,
			0x4c,
			0x12,
			0x91,
		]);
		expect(decodeXorMappedAddressValue(buf, header)).toEqual({
			family: 0x02,
			port: 0x3113,
			addr: Buffer.from([
				0xde, 0x3e, 0xf7, 0x46, 0x70, 0x0f, 0x21, 0xb2, 0x0f, 0xf4, 0xf4, 0x2e,
				0x93, 0x47, 0x61, 0x2c,
			]),
		} satisfies XorMappedAddressAttr["value"]);
	});
});
