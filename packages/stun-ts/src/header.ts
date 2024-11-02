import { magicCookie } from "./consts.js";
import { type ValueOf, assertValueOf, numToBuf } from "./helpers.js";
import type { RawStunMsg } from "./types.js";

export const classRecord = {
  request: 0b00,
  indication: 0b01,
  successResponse: 0b10,
  errorResponse: 0b11,
} as const;

export type Class = ValueOf<typeof classRecord>;

export const methodRecord = {
  binding: 0x0001,
} as const;

export type Method = ValueOf<typeof methodRecord>;

export type MsgType = {
  cls: Class;
  method: Method;
};

export type Header = {
  cls: Class;
  method: Method;
  length: number; // bytes
  magicCookie: typeof magicCookie;
  trxId: Buffer;
};

export function encodeMsgType({ cls, method }: MsgType): Buffer {
  const buf = Buffer.alloc(2);
  let n = 0;
  n |= method & 0b1111;
  if (cls & 0b01) {
    n |= 1 << 4;
  }
  n |= method & (0b111 << 5);
  if (cls & 0b10) {
    n |= 1 << 8;
  }
  n |= method & (0b11111 << 9);
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
    methodRecord,
    new Error(`${m.toString(2)} is not a method.`),
  );
  assertValueOf(c, classRecord, new Error(`${c.toString(2)} is not a class.`));

  return { method: m, cls: c };
}

export function readMsgType(msg: RawStunMsg): MsgType {
  const { method, cls } = decodeMsgType(msg.subarray(0, 2));
  return { method, cls };
}

export function readMsgLength(msg: RawStunMsg): number {
  return msg.subarray(2, 4).readUInt16BE();
}

export function writeMsgLength(msg: RawStunMsg, length: number): void {
  msg.subarray(2, 4).writeUInt16BE(length);
}

export function readMagicCookie(msg: RawStunMsg): number {
  return msg.subarray(4, 8).readInt32BE();
}

export function readTrxId(msg: RawStunMsg): Buffer {
  return Buffer.alloc(12, msg.subarray(8, 20));
}

export function writeTrxId(msg: RawStunMsg, trxId: Buffer): void {
  msg.fill(trxId, 8, 20);
}

export function encodeHeader({
  cls,
  method,
  length,
  trxId,
}: { cls: Class; method: Method; length: number; trxId: Buffer }): Buffer {
  const msgTypeBuf = encodeMsgType({ cls, method });
  const lenBuf = numToBuf(length, 2);
  const cookieBuf = numToBuf(magicCookie, 4);
  return Buffer.concat([msgTypeBuf, lenBuf, cookieBuf, trxId]);
}

export function readHeader(msg: RawStunMsg): Header {
  const { method, cls } = readMsgType(msg);
  const length = readMsgLength(msg);
  const maybeMagicCookie = readMagicCookie(msg);
  if (maybeMagicCookie !== magicCookie) {
    throw new Error(
      `invalid magic cookie; magic cookie must be '${magicCookie}'. the given value is '0x${maybeMagicCookie.toString(16)}'`,
    );
  }
  const trxId = readTrxId(msg);
  return { method, cls, length, magicCookie, trxId };
}
