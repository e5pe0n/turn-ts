import {
  type AttrvDecoders,
  type AttrvEncoders,
  type InputAttr,
  type OutputAttr,
  attrTypeRecord,
  attrvDecoders,
  attrvEncoders,
  buildAttrEncoder,
  buildAttrsDecoder,
} from "./attr.js";
import {
  type Header,
  type MsgClass,
  type MsgMethods,
  buildHeaderDecoder,
  buildHeaderEncoder,
  msgMethodRecord,
  writeMsgLength,
} from "./header.js";
import type { RawStunFmtMsg } from "./types.js";

export type StunMsg<
  Ms extends Record<string, number> = MsgMethods,
  OA = OutputAttr,
> = {
  header: Header<Ms>;
  attrs: OA[];
};

export function buildStunMsgDecoder<
  Ms extends Record<string, number>,
  OA extends { type: string; value: unknown },
>(
  msgMethods: Ms,
  attrTypes: Record<OA["type"], number>,
  attrvDecoders: AttrvDecoders<OA>,
): (msg: RawStunFmtMsg) => StunMsg<Ms, OA> {
  const hDecoder = buildHeaderDecoder(msgMethods);
  const attrsDecoder = buildAttrsDecoder<OA>(attrTypes, attrvDecoders);
  return (msg: RawStunFmtMsg) => {
    const header = hDecoder(msg);
    const attrs = attrsDecoder(
      msg.subarray(20, 20 + header.length),
      header.trxId,
    );
    return {
      header,
      attrs,
    };
  };
}

export const decodeStunMsg: (msg: RawStunFmtMsg) => StunMsg =
  buildStunMsgDecoder<MsgMethods, OutputAttr>(
    msgMethodRecord,
    attrTypeRecord,
    attrvDecoders,
  );

export function buildStunMsgEncoder<
  Ms extends Record<string, number>,
  IA extends { type: string },
>(
  msgMethods: Ms,
  attrTypes: Record<IA["type"], number>,
  attrvEncoders: AttrvEncoders<IA>,
): (args: {
  header: {
    cls: MsgClass;
    method: Extract<keyof Ms, string>;
    trxId: Buffer;
  };
  attrs: IA[];
}) => RawStunFmtMsg {
  const hEncoder = buildHeaderEncoder(msgMethods);
  const attrEncoder = buildAttrEncoder<IA>(attrTypes, attrvEncoders);

  return ({ header: { cls, method, trxId }, attrs }) => {
    const hBuf = hEncoder({
      cls,
      method,
      trxId,
      length: 0,
    });
    let msgBuf = hBuf as RawStunFmtMsg;
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
      msgBuf = Buffer.concat([msgBuf, attrBuf]) as RawStunFmtMsg;
    }

    writeMsgLength(msgBuf, msgBuf.length - hBuf.length);
    return msgBuf;
  };
}

export const encodeStunMsg = buildStunMsgEncoder<MsgMethods, InputAttr>(
  msgMethodRecord,
  attrTypeRecord,
  attrvEncoders,
);
