import { type Attr, decodeAttrs } from "./attr.js";
import { type Header, decodeHeader } from "./header.js";

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
