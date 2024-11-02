import {
  type InputAttr,
  type OutputAttr,
  encodeAttr,
  readAttrs,
} from "./attr.js";
import {
  type Class,
  type Header,
  type Method,
  encodeHeader,
  readHeader,
  writeMsgLength,
} from "./header.js";
import type { RawStunMsg } from "./types.js";

export type StunMsg = {
  header: Header;
  attrs: OutputAttr[];
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
  attrs: InputAttr[];
};

export function encodeStunMsg({
  header: { cls, method, trxId },
  attrs,
}: EncodeStunMsgParams): RawStunMsg {
  const hBuf = encodeHeader({
    cls,
    method,
    trxId,
    length: 0,
  });
  let msgBuf = hBuf as RawStunMsg;
  for (const attr of attrs) {
    const attrBuf = encodeAttr(attr, msgBuf);
    msgBuf = Buffer.concat([msgBuf, attrBuf]) as RawStunMsg;
  }
  writeMsgLength(msgBuf, msgBuf.length - hBuf.length);
  return msgBuf;
}
