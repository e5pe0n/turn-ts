const classRecord = {
	0b00: "request",
	0b01: "indication",
	0b10: "success response",
	0b11: "error response",
} as const;

export type Class = keyof typeof classRecord;
type ClassName = (typeof classRecord)[keyof typeof classRecord];

function isClass(x: number): x is Class {
	return x in classRecord;
}

const methodRecord = {
	0x0001: "Binding",
	0x0101: "Allocate",
} as const;

export type Method = keyof typeof methodRecord;
type MethodName = (typeof methodRecord)[keyof typeof methodRecord];

function isMethod(x: number): x is Method {
	return x in methodRecord;
}

export type Header = {
	cls: Class;
	method: Method;
};

export function readClassAndMethod(n: number): {
	cls: Class;
	method: Method;
} {
	/**
	 *  0  1  2 3 4 5 6 7 8 9 0 1 2 3
	 *  3  2  1 0 9 8 7 6 5 4 3 2 1 0
	 *
	 *  0                 1
	 *  2  3  4 5 6 7 8 9 0 1 2 3 4 5
	 *
	 * +--+--+-+-+-+-+-+-+-+-+-+-+-+-+
	 * |M |M |M|M|M|C|M|M|M|C|M|M|M|M|
	 * |11|10|9|8|7|1|6|5|4|0|3|2|1|0|
	 * +--+--+-+-+-+-+-+-+-+-+-+-+-+-+
	 */
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

	if (!isMethod(m)) {
		throw new Error(`${m.toString(2)} is not a method.`);
	}
	if (!isClass(c)) {
		throw new Error(`${c.toString(2)} is not a class.`);
	}

	return { method: m, cls: c };
}

const exclusiveMaxStunMessageType = 1 << 14;

export function readHeader(buf: Buffer): Header {
	const fst16bits = buf.subarray(0, 2).readUint16BE();
	if (!(exclusiveMaxStunMessageType > fst16bits)) {
		throw new Error("first 2 bits must be zeros.");
	}
	const { method, cls } = readClassAndMethod(fst16bits);
	return { method, cls };
}

export function readMessage(buf: Buffer) {}