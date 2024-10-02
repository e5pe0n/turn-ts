import {
	type Attr,
	type AttrWithoutLength,
	decodeAttrs,
	encodeAttr,
} from "./attr.js";
import {
	type Class,
	type Header,
	type Method,
	decodeHeader,
	encodeHeader,
} from "./header.js";

export type StunMsg = {
	header: Header;
	attrs: Attr[];
};

export function decodeStunMsg(buf: Buffer): StunMsg {
	if (!(buf.length >= 20)) {
		throw new Error(
			`invalid header; expected message length is >= 20. actual is ${buf.length}.`,
		);
	}
	const header = decodeHeader(Buffer.alloc(20, buf.subarray(0, 20)));
	const restBuf = buf.subarray(20);
	if (!(header.length <= restBuf.length)) {
		throw new Error(
			`invalid attrs; expected mesage length is ${header.length}. actual is ${restBuf.length}.`,
		);
	}
	const attrs = decodeAttrs(
		Buffer.alloc(header.length, buf.subarray(20, 20 + header.length)),
		header,
	);
	return {
		header,
		attrs,
	};
}

type EncodeStunMsgParams = {
	header: {
		cls: Class;
		method: Method;
		trxId: Buffer;
	};
	attrs: AttrWithoutLength[];
};

export function encodeStunMsg({
	header: { cls, method, trxId },
	attrs,
}: EncodeStunMsgParams): Buffer {
	const attrsBuf = Buffer.concat(attrs.map((attr) => encodeAttr(attr, trxId)));
	const hBuf = encodeHeader({
		cls,
		method,
		trxId,
		length: attrsBuf.length,
	});
	return Buffer.concat([hBuf, attrsBuf]);
}
