import { assert, assertValueOf, getKey, numToBuf, pad0s } from "@e5pe0n/lib";
import { magicCookie } from "./common.js";

export const HEADER_LENGTH = 20;

export const msgClassRecord = {
  request: 0b00,
  indication: 0b01,
  successResponse: 0b10,
  errorResponse: 0b11,
} as const;
export type MsgClass = keyof typeof msgClassRecord;

export const msgMethodRecord = {
  // https://datatracker.ietf.org/doc/html/rfc5389#autoid-62
  binding: 0x0001,
  // https://datatracker.ietf.org/doc/html/rfc5766#autoid-43
  allocate: 0x0003,
  refresh: 0x0004,
  send: 0x0006,
  data: 0x0007,
  createPermission: 0x0008,
  channelBind: 0x0009,
} as const;
export type MsgMethods = typeof msgMethodRecord;
export type MsgMethod = keyof MsgMethods;

export type MsgType = {
  cls: MsgClass;
  method: MsgMethod;
};

export type Header = {
  cls: MsgClass;
  method: MsgMethod;
  length: number; // bytes
  magicCookie: typeof magicCookie;
  trxId: Buffer;
};

export function encodeMsgType({ cls, method }: MsgType): Buffer {
  const buf = Buffer.alloc(2);
  let n = 0;
  n |= msgMethodRecord[method]! & 0b1111;
  if (msgClassRecord[cls] & 0b01) {
    n |= 1 << 4;
  }
  n |= msgMethodRecord[method]! & (0b111 << 5);
  if (msgClassRecord[cls] & 0b10) {
    n |= 1 << 8;
  }
  n |= msgMethodRecord[method]! & (0b11111 << 9);
  buf.writeUInt16BE(n);
  return buf;
}

export function decodeMsgType(buf: Buffer): MsgType {
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
    msgMethodRecord,
    new Error(
      `invalid method; expected methods are [${Object.values(msgMethodRecord).map((m) => `0x${pad0s(m.toString(16), 3)}`)}]. actual is 0x${pad0s(m.toString(16), 3)}.`,
    ),
  );
  assertValueOf(
    c,
    msgClassRecord,
    new Error(
      `invalid class; expected classes are [${Object.values(msgClassRecord).map((m) => `0x${pad0s(m.toString(16), 3)}`)}]. actual is 0x${pad0s(c.toString(16), 3)}.`,
    ),
  );

  return {
    method: getKey(msgMethodRecord, m),
    cls: getKey(msgClassRecord, c),
  };
}

export function encodeHeader({
  cls,
  method,
  length,
  trxId,
}: {
  cls: MsgClass;
  method: MsgMethod;
  length: number;
  trxId: Buffer;
}): Buffer {
  const msgTypeBuf = encodeMsgType({ cls, method });
  const lenBuf = numToBuf(length, 2);
  const cookieBuf = numToBuf(magicCookie, 4);
  return Buffer.concat([msgTypeBuf, lenBuf, cookieBuf, trxId]);
}

export function decodeHeader(buf: Buffer): Header {
  const { method, cls } = decodeMsgType(buf.subarray(0, 2));
  const length = buf.subarray(2, 4).readUint16BE();
  assert(
    buf.subarray(4, 8).readUint32BE() === magicCookie,
    new Error("invalid stun msg; magic cookie is wrong value."),
  );
  const trxId = buf.subarray(8, 20);
  return { method, cls, length, magicCookie, trxId };
}
