import {
  type InputAttr,
  type OutputAttr,
  attrTypeRecord,
  buildAttrEncoder,
  attrValueEncoder,
  readAttrs,
} from "./attr.js";
import {
  type Header,
  type MsgClass,
  type MsgMethod,
  encodeHeader,
  readHeader,
  writeMsgLength,
} from "./header.js";
import type { RawStunMsg } from "./types.js";

export type StunMsg = {
  header: Header;
  attrs: OutputAttr[];
};

export function decodeStunMsg(msg: RawStunMsg): StunMsg {
  const header = readHeader(msg);
  const attrs = readAttrs(msg, header);
  return {
    header,
    attrs,
  };
}

export type EncodeStunMsgParams = {
  header: {
    cls: MsgClass;
    method: MsgMethod;
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
  if (attrs.length >= 2) {
    const idx = attrs.findIndex((v) => v.type === "FINGERPRINT");
    if (idx !== -1 && idx !== attrs.length - 1) {
      throw new Error(
        "invalid attrs; FINGERPRINT must be at the last in `attrs`",
      );
    }
  }
  // for (const attr of attrs) {
  //   const attrBuf = encodeAttr(attr, msgBuf);
  //   msgBuf = Buffer.concat([msgBuf, attrBuf]) as RawStunMsg;
  // }
  const attrEncoder = buildAttrEncoder<typeof attrTypeRecord, InputAttr>(
    attrTypeRecord,
    attrValueEncoder,
  );
  for (const attr of attrs) {
    const attrBuf = attrEncoder(attr, msgBuf);
    msgBuf = Buffer.concat([msgBuf, attrBuf]) as RawStunMsg;
  }

  writeMsgLength(msgBuf, msgBuf.length - hBuf.length);
  return msgBuf;
}
