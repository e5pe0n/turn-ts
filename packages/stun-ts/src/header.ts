import { assertKeyOf, assertValueOf, getKey, numToBuf } from "@e5pe0n/lib";
import { magicCookie } from "./consts.js";
import type { RawStunFmtMsg } from "./types.js";

export const msgClassRecord = {
  Request: 0b00,
  Indication: 0b01,
  SuccessResponse: 0b10,
  ErrorResponse: 0b11,
} as const;
export type MsgClass = keyof typeof msgClassRecord;

export const msgMethodRecord = {
  Binding: 0x0001,
} as const;
export type MsgMethods = typeof msgMethodRecord;
export type MsgMethod = keyof MsgMethods;

export type MsgType<Ms extends Record<string, number> = MsgMethods> = {
  cls: MsgClass;
  method: Extract<keyof Ms, string>;
};

export type Header<Ms extends Record<string, number> = MsgMethods> = {
  cls: MsgClass;
  method: Extract<keyof Ms, string>;
  length: number; // bytes
  magicCookie: typeof magicCookie;
  trxId: Buffer;
};

export function buildMsgTypeEncoder<Ms extends Record<string, number>>(
  msgMethods: Ms,
): ({ cls, method }: MsgType<Ms>) => Buffer {
  return ({ cls, method }) => {
    const x = method;
    assertKeyOf(
      cls,
      msgClassRecord,
      new Error(`invalid class; ${cls} is not a valid class.`),
    );
    assertKeyOf(
      method,
      msgMethods,
      new Error(`invalid method; ${method} is not a valid method.`),
    );
    const buf = Buffer.alloc(2);
    let n = 0;
    n |= msgMethods[method]! & 0b1111;
    if (msgClassRecord[cls] & 0b01) {
      n |= 1 << 4;
    }
    n |= msgMethods[method]! & (0b111 << 5);
    if (msgClassRecord[cls] & 0b10) {
      n |= 1 << 8;
    }
    n |= msgMethods[method]! & (0b11111 << 9);
    buf.writeUInt16BE(n);
    return buf;
  };
}

export const encodeMsgType: ({ cls, method }: MsgType) => Buffer =
  buildMsgTypeEncoder(msgMethodRecord);

export function buildMsgTypeDecoder<Ms extends Record<string, number>>(
  msgMethods: Ms,
): (buf: Buffer) => MsgType<Ms> {
  return (buf) => {
    const n = buf.readUInt16BE();
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

    assertValueOf(
      m,
      msgMethods,
      new Error(
        `invalid method; expected methods are ${Object.values(msgMethods).map((m) => m.toString(2))}. actual is ${m.toString(2)}.`,
      ),
    );
    assertValueOf(
      c,
      msgClassRecord,
      new Error(`${c.toString(2)} is not a class.`),
    );

    return {
      method: getKey(msgMethods, m),
      cls: getKey(msgClassRecord, c),
    } as MsgType<Ms>;
  };
}

export const decodeMsgType: (buf: Buffer) => MsgType =
  buildMsgTypeDecoder(msgMethodRecord);

export function readMsgType(msg: RawStunFmtMsg): MsgType {
  const { method, cls } = decodeMsgType(msg.subarray(0, 2));
  return { method, cls };
}

export function readMsgLength(msg: RawStunFmtMsg): number {
  return msg.subarray(2, 4).readUInt16BE();
}

export function writeMsgLength(msg: RawStunFmtMsg, length: number): void {
  msg.subarray(2, 4).writeUInt16BE(length);
}

export function readMagicCookie(msg: RawStunFmtMsg): number {
  return msg.subarray(4, 8).readInt32BE();
}

export function readTrxId(msg: RawStunFmtMsg): Buffer {
  return Buffer.alloc(12, msg.subarray(8, 20));
}

export function writeTrxId(msg: RawStunFmtMsg, trxId: Buffer): void {
  msg.fill(trxId, 8, 20);
}

export function buildHeaderEncoder<Ms extends Record<string, number>>(
  msgMethods: Ms,
): ({
  cls,
  method,
  length,
  trxId,
}: {
  cls: MsgClass;
  method: Extract<keyof Ms, string>;
  length: number;
  trxId: Buffer;
}) => Buffer {
  const msgTypeEncoder = buildMsgTypeEncoder(msgMethods);
  return ({ cls, method, length, trxId }) => {
    const msgTypeBuf = msgTypeEncoder({ cls, method });
    const lenBuf = numToBuf(length, 2);
    const cookieBuf = numToBuf(magicCookie, 4);
    return Buffer.concat([msgTypeBuf, lenBuf, cookieBuf, trxId]);
  };
}

export const encodeHeader: ({
  cls,
  method,
  length,
  trxId,
}: {
  cls: MsgClass;
  method: MsgMethod;
  length: number;
  trxId: Buffer;
}) => Buffer = buildHeaderEncoder(msgMethodRecord);

export function buildHeaderDecoder<Ms extends Record<string, number>>(
  msgMethods: Ms,
): (msg: RawStunFmtMsg) => Header<Ms> {
  const msgTypeDecoder = buildMsgTypeDecoder(msgMethods);
  return (msg) => {
    const { method, cls } = msgTypeDecoder(msg);
    const length = readMsgLength(msg);
    const trxId = readTrxId(msg);
    return { method, cls, length, magicCookie, trxId };
  };
}

export function readHeader(msg: RawStunFmtMsg): Header {
  const { method, cls } = readMsgType(msg);
  const length = readMsgLength(msg);
  const trxId = readTrxId(msg);
  return { method, cls, length, magicCookie, trxId };
}
