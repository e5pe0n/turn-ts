import { describe, expect, it } from "vitest";
import { assertStunMSg } from "./agent.js";

describe("assertStunMsg", () => {
  it("throws an error if the STUN message is not >= 20 bytes", () => {
    const buf = Buffer.from([
      // 8 bytes
      0x00, // STUN Message Type
      0x01,
      0x00, // Message Length
      0x08,
      0x21, // Magic Cookie
      0x12,
      0xa4,
      0x42,
      // Trx Id (12 - 1 bytes)
      0x81,
      0x4c,
      0x72,
      0x09,
      0xa7,
      0x68,
      0xf9,
      0x89,
      0xf8,
      0x0b,
      0x73,
      // 0xbd		-1 byte
    ]);
    expect(() => assertStunMSg(buf)).toThrowError(/invalid stun msg/i);
  });
  it("throws an error if the length of a STUN message is not a multiple of 4", () => {
    const trxId = Buffer.from([
      0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
    ]);
    const hBuf = Buffer.concat([
      Buffer.from([
        0x00, // STUN Message Type: Binding request
        0x01,
        0x00, // Message Length: 12 bytes
        0x0c,
        0x21, // Magic Cookie
        0x12,
        0xa4,
        0x42,
      ]),
      trxId,
    ]);
    const buf = Buffer.concat([
      hBuf, // 20 bytes
      Buffer.alloc(1),
    ]);
    expect(() => assertStunMSg(buf)).toThrowError(/invalid stun msg/i);
  });
  it("throws error if a STUN message header does not include valid magic cookie", () => {
    const trxId = Buffer.from([
      0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
    ]);
    const buf = Buffer.concat([
      Buffer.from([
        0x00, // STUN Message Type
        0x01,
        0x10, // Message Length
        0x11,
        0x21, // Magic Cookie
        0x12,
        0xa4,
        0x41,
      ]),
      trxId,
    ]);
    expect(() => assertStunMSg(buf)).toThrowError(/invalid magic cookie/);
  });
});
