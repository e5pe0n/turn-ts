import {
  type AttrvDecoders,
  type AttrvEncoders,
  type InputAttr,
  type OutputAttr,
  attrTypeRecord,
  attrValueDecoders,
  attrValueEncoders,
  buildAttrEncoder,
  buildAttrsDecoder,
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

export type StunMsg<OA = OutputAttr> = {
  header: Header;
  attrs: OA[];
};

export function buildMsgDecoder<OA extends { type: string; value: unknown }>(
  attrTypes: Record<OA["type"], number>,
  attrvDecoders: AttrvDecoders<OA>,
): (msg: RawStunMsg) => StunMsg<OA> {
  const attrsDecoder = buildAttrsDecoder<OA>(attrTypes, attrvDecoders);
  return (msg: RawStunMsg) => {
    const header = readHeader(msg);
    const attrs = attrsDecoder(msg.subarray(20, 20 + header.length), header);
    return {
      header,
      attrs,
    };
  };
}

export const decodeStunMsg: (msg: RawStunMsg) => StunMsg =
  buildMsgDecoder<OutputAttr>(attrTypeRecord, attrValueDecoders);

export function buildMsgEncoder<IA extends { type: string }>(
  attrTypes: Record<IA["type"], number>,
  attrvEncoders: AttrvEncoders<IA>,
): (args: {
  header: {
    cls: MsgClass;
    method: MsgMethod;
    trxId: Buffer;
  };
  attrs: IA[];
}) => RawStunMsg {
  const attrEncoder = buildAttrEncoder<IA>(attrTypes, attrvEncoders);

  return ({ header: { cls, method, trxId }, attrs }) => {
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

    for (const attr of attrs) {
      const attrBuf = attrEncoder(attr, msgBuf);
      msgBuf = Buffer.concat([msgBuf, attrBuf]) as RawStunMsg;
    }

    writeMsgLength(msgBuf, msgBuf.length - hBuf.length);
    return msgBuf;
  };
}

export const encodeStunMsg = buildMsgEncoder<InputAttr>(
  attrTypeRecord,
  attrValueEncoders,
);
