import { describe, expect, expectTypeOf, it, test } from "vitest";
import {
  type ValueOf,
  assertValueOf,
  fAddr,
  fBuf,
  isValueOf,
  numToBuf,
  xorBufs,
} from "./helpers.js";

const addrFamilyRecord = {
  ipV4: 0x01,
  ipV6: 0x02,
} as const;
type AddrFamilyRecord = typeof addrFamilyRecord;
type AddrFamily = (typeof addrFamilyRecord)[keyof typeof addrFamilyRecord];

test("ValueOf", () => {
  expectTypeOf<ValueOf<typeof addrFamilyRecord>>().toEqualTypeOf<AddrFamily>();
});

test("isValueOf", () => {
  expectTypeOf(
    isValueOf<AddrFamilyRecord, AddrFamily>,
  ).guards.toEqualTypeOf<AddrFamily>();
});

test("assertValueOf", () => {
  expectTypeOf(
    assertValueOf<AddrFamilyRecord, AddrFamily>,
  ).asserts.toEqualTypeOf<AddrFamily>();
});

describe("numToBuf", () => {
  it("convert a number to a buffer", () => {
    const n = 0x2112a442;
    expect(numToBuf(n, 4)).toEqual(Buffer.from([0x21, 0x12, 0xa4, 0x42]));
  });
});

describe("xorBufs", () => {
  it("throws an error if two buffers have different lengths", () => {
    const a = Buffer.from([0x0a3]);
    const b = Buffer.from([0x07b, 0x00]);
    expect(() => xorBufs(a, b)).toThrowError(/the same length/);
  });
  describe("it returns xored buffer", () => {
    test("1 bytes buffers", () => {
      const a = Buffer.from([0x8e]);
      const b = Buffer.from([0xa5]);
      expect(xorBufs(a, b)).toEqual(Buffer.from([0x2b]));
    });
    test("2 bytes buffers", () => {
      const a = Buffer.from([0x8e, 0x33]);
      const b = Buffer.from([0xa5, 0x76]);
      expect(xorBufs(a, b)).toEqual(Buffer.from([0x2b, 0x45]));
    });
    test("3 bytes buffers", () => {
      const a = Buffer.from([0x8e, 0x33, 0xc8]);
      const b = Buffer.from([0xa5, 0x76, 0x37]);
      expect(xorBufs(a, b)).toEqual(Buffer.from([0x2b, 0x45, 0xff]));
    });
    test("4 bytes buffers", () => {
      const a = Buffer.from([0x8e, 0x33, 0xc8, 0x3c]);
      const b = Buffer.from([0xa5, 0x76, 0x37, 0x18]);
      expect(xorBufs(a, b)).toEqual(Buffer.from([0x2b, 0x45, 0xff, 0x24]));
    });
    test("5 bytes buffers", () => {
      const a = Buffer.from([0x8e, 0x33, 0xc8, 0x3c, 0x3b]);
      const b = Buffer.from([0xa5, 0x76, 0x37, 0x18, 0x0b]);
      expect(xorBufs(a, b)).toEqual(
        Buffer.from([0x2b, 0x45, 0xff, 0x24, 0x30]),
      );
    });
  });
});

describe("fBuf", () => {
  it("returns a string of numbers consisting of the buffer content", () => {
    const res = fBuf(Buffer.from([43, 69, 255, 36, 48]));
    expect(res).toEqual("43,69,255,36,48");
  });
});

describe("fAddr", () => {
  it("returns a string representation of the given IP v4 address", () => {
    const res = fAddr(Buffer.from([0xde, 0x3e, 0xf7, 0x46]));
    expect(res).toMatch("222.62.247.70");
  });
  it("returns a string representation of the given IP v6 address", () => {
    const res = fAddr(
      Buffer.from([
        0x20, 0x01, 0x0d, 0xb8, 0x85, 0xa3, 0x00, 0x00, 0x00, 0x00, 0x8a, 0x2e,
        0x03, 0x70, 0x73, 0x34,
      ]),
    );
    expect(res).toMatch("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
  });
});
