import { describe, expect, it, test } from "vitest";
import {
  type Header,
  type MsgType,
  decodeMsgType,
  encodeHeader,
  encodeMsgType,
} from "./header.js";

describe("encodeMsgType", () => {
  test.each([
    {
      arg: { method: "binding", cls: "request" },
      expected: Buffer.from([0b00_000000, 0b00000001]),
    },
    {
      arg: {
        method: "binding",
        cls: "successResponse",
      },
      expected: Buffer.from([0b00_000001, 0b00000001]),
    },
    {
      arg: {
        method: "binding",
        cls: "errorResponse",
      },
      expected: Buffer.from([0b00_000001, 0b00010001]),
    },
  ] satisfies {
    arg: MsgType;
    expected: Buffer;
  }[])("encodes a $methodName $className message type", ({ arg, expected }) => {
    expect(encodeMsgType(arg)).toEqual(expected);
  });
});

describe("decodeMsgType", () => {
  test.each([
    {
      arg: Buffer.from([0b000000, 0b00000001]),
      expected: {
        method: "binding",
        cls: "request",
      },
    } as const,
    {
      arg: Buffer.from([0b000001, 0b00000001]),
      expected: {
        method: "binding",
        cls: "successResponse",
      },
    } as const,
    {
      arg: Buffer.from([0b000001, 0b00010001]),
      expected: {
        method: "binding",
        cls: "errorResponse",
      },
    } as const,
  ])(
    "decodes a $expected.method $expected.cls message type",
    ({
      arg,
      expected,
    }: {
      arg: Buffer;
      expected: MsgType;
    }) => {
      expect(decodeMsgType(arg)).toEqual(expected);
    },
  );
  it("throws error if result is not a method", () => {
    const arg = Buffer.from([0x00, 0x00]);
    expect(() => decodeMsgType(arg)).toThrowError(/invalid method/);
  });
});

describe("encodeHeader", () => {
  it("encodes a STUN message header", () => {
    const trxId = Buffer.from([
      0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
    ]);
    const res = encodeHeader({
      cls: "successResponse",
      method: "binding",
      length: 28,
      trxId,
    });
    expect(res).toEqual(
      Buffer.concat([
        Buffer.from([
          0b00_000001, // STUN Message Type
          0x01,
          0x00, // Message Length
          0x1c,
          0x21, // Magic Cookie
          0x12,
          0xa4,
          0x42,
        ]),
        trxId,
      ]),
    );
  });
});
