import { describe, expect, it } from "vitest";
import { magicCookie } from "./common.js";
import { StunMsg } from "./msg.js";
import type { RawStunMsg } from "./types.js";

const ctx: {
  trxId: Buffer;
} = {
  trxId: Buffer.from([
    0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
  ]),
} as const;

describe("StunMsg", () => {
  describe("build()", () => {
    it("creates a StunMsg with XOR-MAPPED-ADDRESS attr", () => {
      const msg = StunMsg.build({
        header: {
          cls: "successResponse",
          method: "binding",
          trxId: ctx.trxId,
        },
        attrs: {
          xorMappedAddress: {
            family: "IPv4",
            port: 12345,
            address: "201.199.197.89",
          },
        },
      });
      expect(msg).toEqual({
        header: {
          cls: "successResponse",
          method: "binding",
          trxId: ctx.trxId,
          length: 12,
          magicCookie,
        },
        attrs: {
          xorMappedAddress: {
            family: "IPv4",
            port: 12345,
            address: "201.199.197.89",
          },
        },
        raw: Buffer.concat([
          // Header
          Buffer.from([
            0x01, // Message Type
            0x01,
            0x00, // Length: 12 bytes
            0x0c,
            0x21, // Magic Cookie
            0x12,
            0xa4,
            0x42,
          ]),
          ctx.trxId,
          // Attrs
          Buffer.from([
            0x00, // Type
            0x20,
            0x00, // Length
            0x08,
            // Value
            0x00,
            0x01, // Family (IPv4)
            0x11, // Port
            0x2b,
            0xe8, // X-Address (IPv4)
            0xd5,
            0x61,
            0x1b,
          ]),
        ]) as RawStunMsg,
      } satisfies StunMsg);
    });
    it("creates a StunMsg with MESSAGE-INTEGRITY and FINGERPRINT attr", () => {
      const msg = StunMsg.build({
        header: {
          cls: "successResponse",
          method: "binding",
          trxId: ctx.trxId,
        },
        attrs: {
          xorMappedAddress: {
            family: "IPv4",
            port: 12345,
            address: "201.199.197.89",
          },
          messageIntegrity: {
            term: "short",
            password: "pass",
          },
          fingerprint: true,
        },
      });
      expect(msg).toEqual({
        header: {
          cls: "successResponse",
          method: "binding",
          trxId: ctx.trxId,
          length: 44,
          magicCookie,
        },
        attrs: {
          xorMappedAddress: {
            family: "IPv4",
            port: 12345,
            address: "201.199.197.89",
          }, // 4 + 8
          messageIntegrity: expect.any(Buffer), // 4 + 20
          fingerprint: expect.any(Buffer), // 4 + 4
        },
        raw: expect.any(Buffer),
      } satisfies StunMsg);
      expect(msg.raw).toHaveLength(20 + 44);
      expect(msg.raw.subarray(0, 20 + 12)).toEqual(
        Buffer.concat([
          // Header
          Buffer.from([
            0x01, // Message Type
            0x01,
            0x00, // Length: 44 bytes
            0x2c,
            0x21, // Magic Cookie
            0x12,
            0xa4,
            0x42,
          ]),
          ctx.trxId,
          // Attrs
          Buffer.from([
            0x00, // Type
            0x20,
            0x00, // Length
            0x08,
            // Value
            0x00,
            0x01, // Family (IPv4)
            0x11, // Port
            0x2b,
            0xe8, // X-Address (IPv4)
            0xd5,
            0x61,
            0x1b,
          ]),
        ]),
      );
      expect(msg.raw.subarray(20 + 12, 20 + 12 + 4)).toEqual(
        Buffer.from([
          0x00, // Type
          0x08,
          0x00, // Length
          0x14,
        ]),
      );
      expect(msg.raw.subarray(20 + 12 + 24, 20 + 12 + 24 + 4)).toEqual(
        Buffer.from([
          0x80, // Type
          0x28,
          0x00, // Length
          0x04,
        ]),
      );
    });
  });
  describe("from()", () => {
    it("creates StunMsg from raw STUN msg", () => {
      const hBuf = Buffer.concat([
        Buffer.from([
          0x01, // Message Type
          0x01,
          0x00, // Message Length: 12 bytes
          0x0c,
          0x21, // Magic Cookie
          0x12,
          0xa4,
          0x42,
        ]),
        ctx.trxId,
      ]);
      const attrBuf = Buffer.from([
        0x00, // Attr Type: XOR-MAPPED-ADDRESS
        0x20,
        0x00, // Attr Length: 8 bytes
        0x08,
        // Attr Value
        0x00,
        0x01, // Family: IPv4
        0x11, // X-Port
        0x2b,
        0xe8, // X-Address (IPv4)
        0xd5,
        0x61,
        0x1b,
      ]); // 12 bytes
      const raw = Buffer.concat([hBuf, attrBuf]) as RawStunMsg;
      const msg = StunMsg.from(raw);
      expect(msg).toEqual({
        header: {
          cls: "successResponse",
          method: "binding",
          length: 12,
          trxId: ctx.trxId,
          magicCookie,
        },
        attrs: {
          xorMappedAddress: {
            family: "IPv4",
            port: 12345,
            address: "201.199.197.89",
          },
        },
        raw,
      } satisfies StunMsg);
    });
    it.todo(
      "does not throw an error if FINGERPRINT attr is not at the last",
      () => {},
    );
    it.todo("throws an error if FINGERPRINT attr is not at the last", () => {});
  });
});

// describe("assertStunMsg", () => {
//   it("throws an error if the STUN message is not >= 20 bytes", () => {
//     const buf = Buffer.from([
//       // 8 bytes
//       0x00, // STUN Message Type
//       0x01,
//       0x00, // Message Length
//       0x08,
//       0x21, // Magic Cookie
//       0x12,
//       0xa4,
//       0x42,
//       // Trx Id (12 - 1 bytes)
//       0x81,
//       0x4c,
//       0x72,
//       0x09,
//       0xa7,
//       0x68,
//       0xf9,
//       0x89,
//       0xf8,
//       0x0b,
//       0x73,
//       // 0xbd		-1 byte
//     ]);
//     expect(() => assertRawStunFmtMsg(buf)).toThrowError(/invalid stun msg/i);
//   });
//   it("throws an error if the length of a STUN message is not a multiple of 4", () => {
//     const trxId = Buffer.from([
//       0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
//     ]);
//     const hBuf = Buffer.concat([
//       Buffer.from([
//         0x00, // STUN Message Type: binding request
//         0x01,
//         0x00, // Message Length: 12 bytes
//         0x0c,
//         0x21, // Magic Cookie
//         0x12,
//         0xa4,
//         0x42,
//       ]),
//       trxId,
//     ]);
//     const buf = Buffer.concat([
//       hBuf, // 20 bytes
//       Buffer.alloc(1),
//     ]);
//     expect(() => assertRawStunFmtMsg(buf)).toThrowError(/invalid stun msg/i);
//   });
//   it("throws error if a STUN message header does not include valid magic cookie", () => {
//     const trxId = Buffer.from([
//       0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
//     ]);
//     const buf = Buffer.concat([
//       Buffer.from([
//         0x00, // STUN Message Type
//         0x01,
//         0x10, // Message Length
//         0x11,
//         0x21, // Magic Cookie
//         0x12,
//         0xa4,
//         0x41,
//       ]),
//       trxId,
//     ]);
//     expect(() => assertRawStunFmtMsg(buf)).toThrowError(/invalid magic cookie/);
//   });
// });
