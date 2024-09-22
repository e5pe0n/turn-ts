import { magicCookie } from "./consts.js";
import type { Header } from "./header.js";
import {
	type Override,
	type ValueOf,
	assertValueOf,
	isValueOf,
} from "./helpers.js";

const compReqRange = [0x0000, 0x7fff] as const;
const compOptRange = [0x8000, 0xffff] as const;

const compReqAttrTypeRecord = {
	"MAPPED-ADDRESS": 0x0001,
	USERNAME: 0x0006,
	"MESSAGE-INTEGRITY": 0x0008,
	"ERROR-CODE": 0x0009,
	"UNKNOWN-ATTRIBUTES": 0x000a,
	REALM: 0x0014,
	NONCE: 0x0015,
	"XOR-MAPPED-ADDRESS": 0x0020,
} as const;
type CompReqAttrType = ValueOf<typeof compReqAttrTypeRecord>;

const compOptAttrTypeRecord = {
	SOFTWARE: 0x8022,
	"ALTERNATE-SERVER": 0x8023,
	FINGERPRINT: 0x8028,
} as const;
type CompOptAttrType = ValueOf<typeof compOptAttrTypeRecord>;

type AttrType = CompReqAttrType | CompOptAttrType;

function isAttrType(x: number): x is AttrType {
	return (
		isValueOf(x, compReqAttrTypeRecord) || isValueOf(x, compOptAttrTypeRecord)
	);
}

function fAttrType(
	strings: TemplateStringsArray,
	v: CompReqAttrType | CompOptAttrType,
): string {
	{
		const [kv] = Object.entries(compReqAttrTypeRecord).filter(
			([, value]) => value === v,
		);
		if (kv) {
			return kv[0];
		}
	}
	{
		const [kv] = Object.entries(compOptAttrTypeRecord).filter(
			([, value]) => value === v,
		);
		if (kv) {
			return kv[0];
		}
		throw new Error(`invalid value: '${v}' is not a value of Attribute Type.`);
	}
}

export const addrFamilyRecord = {
	ipV4: 0x01,
	ipV6: 0x02,
} as const;
type AddrFamily = ValueOf<typeof addrFamilyRecord>;

export type MappedAddressAttr = {
	type: (typeof compReqAttrTypeRecord)["MAPPED-ADDRESS"];
	length: number;
	value: {
		family: AddrFamily;
		port: number;
		addr: Uint8Array;
	};
};

type UsernameAttr = {
	type: (typeof compReqAttrTypeRecord)["USERNAME"];
	length: number;
	value: unknown;
};

type MessageIntegrityAttr = {
	type: (typeof compReqAttrTypeRecord)["MESSAGE-INTEGRITY"];
	length: number;
	value: unknown;
};

type ErrorCodeAttr = {
	type: (typeof compReqAttrTypeRecord)["ERROR-CODE"];
	length: number;
	value: unknown;
};

type UnknownAttributesAttr = {
	type: (typeof compReqAttrTypeRecord)["UNKNOWN-ATTRIBUTES"];
	length: number;
	value: unknown;
};

type RealmAttr = {
	type: (typeof compReqAttrTypeRecord)["REALM"];
	length: number;
	value: unknown;
};

type NonceAttr = {
	type: (typeof compReqAttrTypeRecord)["NONCE"];
	length: number;
	value: unknown;
};

export type XorMappedAddressAttr = {
	type: (typeof compReqAttrTypeRecord)["XOR-MAPPED-ADDRESS"];
	length: number;
	value:
		| {
				family: (typeof addrFamilyRecord)["ipV4"];
				port: number;
				addr: Buffer; // 32 bits
		  }
		| {
				family: (typeof addrFamilyRecord)["ipV6"];
				port: number;
				addr: Buffer; // 128 bits
		  };
};

type SoftwareAttr = {
	type: (typeof compOptAttrTypeRecord)["SOFTWARE"];
	length: number;
	value: unknown;
};

type AlternateServerAttr = {
	type: (typeof compOptAttrTypeRecord)["ALTERNATE-SERVER"];
	length: number;
	value: unknown;
};

type FingerprintAttr = {
	type: (typeof compOptAttrTypeRecord)["FINGERPRINT"];
	length: number;
	value: unknown;
};

type Attr =
	| MappedAddressAttr
	| UsernameAttr
	| MessageIntegrityAttr
	| ErrorCodeAttr
	| UnknownAttributesAttr
	| RealmAttr
	| NonceAttr
	| XorMappedAddressAttr
	| SoftwareAttr
	| AlternateServerAttr
	| FingerprintAttr;

export function decodeMappedAddressValue(
	buf: Buffer,
): MappedAddressAttr["value"] {
	/**
	 *   0                   1                   2                   3
	 *   0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
	 *  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	 *  |0 0 0 0 0 0 0 0|    Family     |           Port                |
	 *  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	 *  |                                                               |
	 *  |                 Address (32 bits or 128 bits)                 |
	 *  |                                                               |
	 *  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	 */
	const family = buf[1]!;
	assertValueOf(
		family,
		addrFamilyRecord,
		new Error(`invalid address family: '${family}' is not a address family.`),
	);
	const port = buf.subarray(2, 4).readInt16BE();
	let addr: Uint8Array;
	switch (family) {
		case addrFamilyRecord.ipV4:
			addr = new Uint8Array(buf.subarray(4, 8));
			break;
		case addrFamilyRecord.ipV6:
			addr = new Uint8Array(buf.subarray(4, 20));
			break;
	}
	return { family, addr, port };
}

export function decodeXorMappedAddressValue(
	buf: Buffer,
	header: Header,
): XorMappedAddressAttr["value"] {
	/**
	 *    0                   1                   2                   3
	 *    0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
	 *   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	 *   |x x x x x x x x|    Family     |         X-Port                |
	 *   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	 *   |                X-Address (Variable)
	 *   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	 */
	const family = buf[1]!;
	assertValueOf(
		family,
		addrFamilyRecord,
		new Error(`invalid address family: '${family}' is not a address family.`),
	);
	const port = buf.subarray(2, 4).readInt16BE() ^ (magicCookie >>> 16);
	switch (family) {
		case addrFamilyRecord.ipV4: {
			const xres = buf.subarray(4, 8).readInt32BE() ^ magicCookie;
			const addr = Buffer.alloc(4);
			addr.writeInt32BE(xres);
			return { port, family, addr };
		}
		case addrFamilyRecord.ipV6: {
			const xres0 = buf.subarray(4, 8).readInt32BE() ^ magicCookie;
			const xres1 =
				buf.subarray(8, 12).readInt32BE() ^
				header.trxId.subarray(0, 4).readInt32BE();
			const xres2 =
				buf.subarray(12, 16).readInt32BE() ^
				header.trxId.subarray(4, 8).readInt32BE();
			const xres3 =
				buf.subarray(16, 20).readInt32BE() ^
				header.trxId.subarray(8, 12).readInt32BE();
			const addr = Buffer.alloc(16);
			addr.writeInt32BE(xres0);
			addr.writeInt32BE(xres1, 4);
			addr.writeInt32BE(xres2, 8);
			addr.writeInt32BE(xres3, 12);
			return { port, family, addr };
		}
	}
}

export function decodeAttrs(buf: Buffer, header: Header): Attr[] {
	/**
	 *   0                   1                   2                   3
	 *   0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
	 *  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	 *  |         Type                  |            Length             |
	 *  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	 *  |                         Value (variable)                ....
	 *  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
	 */
	const processingAttrs: Override<Attr, { value: Buffer }>[] = [];
	let bufLength = buf.length;
	while (bufLength > 4) {
		const attrType = buf.subarray(0, 2).readUInt16BE();
		if (!isAttrType(attrType)) {
			// TODO: Distinguish between comprehension-required attributes
			// and comprehension-optional attributes.
			throw new Error(`invalid attr type; ${attrType} is not a attr type.`);
		}
		const length = buf.subarray(2, 4).readUInt16BE();
		bufLength -= 4;
		if (bufLength < length) {
			throw new Error(
				`invalid attr length; given ${fAttrType`${attrType}`} value length is ${length}, but the actual value length is ${bufLength}.`,
			);
		}
		const value = Buffer.alloc(length, buf.subarray(4, 4 + length));
		bufLength -= length;
		processingAttrs.push({ type: attrType, length, value });
	}
	const attrs: Attr[] = [];
	for (const { type, length, value } of processingAttrs) {
		switch (type) {
			case compReqAttrTypeRecord["MAPPED-ADDRESS"]: {
				const res = decodeMappedAddressValue(value);
				attrs.push({ type, length, value: res });
				break;
			}
			case compReqAttrTypeRecord["XOR-MAPPED-ADDRESS"]: {
				const res = decodeXorMappedAddressValue(value, header);
				attrs.push({ type, length, value: res });
				break;
			}
		}
	}
	return attrs;
}
