import { describe, expect, it } from "vitest";
import { decodeTurnMsg, encodeTurnMsg } from "./msg.js";
import type { RawStunFmtMsg } from "@e5pe0n/stun-ts";

describe("encodeTurnMsg", () => {
  it("encodes a turn msg", () => {
    const trxId = Buffer.from([
      0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
    ]);
    const res = encodeTurnMsg({
      header: {
        cls: "Request",
        method: "Allocate",
        trxId,
      },
      attrs: [
        {
          type: "REQUESTED-TRANSPORT",
          value: 17,
        },
        {
          type: "LIFETIME",
          value: 3600,
        },
      ],
    });
    expect(res).toEqual(
      Buffer.concat([
        // Header
        Buffer.from([
          0b00_000000, // Message Type
          0b00000011,
          0x00, // Length: 16 bytes
          0x10,
          0x21, // Magic Cookie
          0x12,
          0xa4,
          0x42,
        ]),
        trxId,
        //  Attrs
        Buffer.from([0x00, 0x19, 0x00, 0x04, 0x11, 0, 0, 0]),
        Buffer.from([0x00, 0x0d, 0x00, 0x04, 0, 0, 0x0e, 0x10]),
      ]),
    );
  });
});

describe("decodeTurnMsg", () => {
  it("decodes a turn msg", () => {
    const trxId = Buffer.from([
      0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
    ]);
    const buf = Buffer.concat([
      // Header
      Buffer.from([
        0b00_000000, // Message Type
        0b00000011,
        0x00, // Length: 16 bytes
        0x10,
        0x21, // Magic Cookie
        0x12,
        0xa4,
        0x42,
      ]),
      trxId,
      //  Attrs
      Buffer.from([0x00, 0x19, 0x00, 0x04, 0x11, 0, 0, 0]),
      Buffer.from([0x00, 0x0d, 0x00, 0x04, 0, 0, 0x0e, 0x10]),
    ]);
    const res = decodeTurnMsg(buf as RawStunFmtMsg);
  });
});
