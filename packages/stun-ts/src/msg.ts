import {
  type Attr,
  type AttrWithoutLength,
  encodeAttr,
  readAttrs,
} from "./attr.js";
import {
  type Class,
  type Header,
  type Method,
  encodeHeader,
  readHeader,
} from "./header.js";
import type { RawStunMsg } from "./types.js";

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
  const msg = buf as RawStunMsg;
  const header = readHeader(msg);
  const restBufLength = msg.length - 20;
  if (!(header.length <= restBufLength)) {
    throw new Error(
      `invalid attrs; expected message length is ${header.length}. actual is ${restBufLength}.`,
    );
  }
  const attrs = readAttrs(msg, header);
  return {
    header,
    attrs,
  };
}

export type EncodeStunMsgParams = {
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
