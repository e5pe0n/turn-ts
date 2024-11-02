import { describe, expect, it } from "vitest";
import {
  type ErrorCodeAttr,
  type MappedAddressAttr,
  type NonceAttr,
  type OutputAttr,
  type RealmAttr,
  type UsernameAttr,
  type XorMappedAddressAttr,
  decodeAttrs,
  decodeErrorCodeValue,
  decodeMappedAddressValue,
  decodeNonceValue,
  decodeRealmValue,
  decodeUsernameValue,
  decodeXorMappedAddressValue,
  encodeAttr,
  encodeErrorCodeValue,
  encodeMappedAddressValue,
  encodeNonceValue,
  encodeRealmValue,
  encodeUsernameValue,
  encodeXorMappedAddressValue,
} from "./attr.js";
import { magicCookie } from "./consts.js";
import { type Header, classRecord, methodRecord } from "./header.js";
import type { RawStunMsg } from "./types.js";

describe("encodeMappedAddressValue", () => {
  it("encodes IPv4 MAPPED-ADDRESS value", () => {
    const value: MappedAddressAttr["value"] = {
      family: "IPv4",
      port: 12345,
      address: "201.199.197.89",
    };
    expect(encodeMappedAddressValue(value)).toEqual(
      Buffer.from([
        0x00,
        0x01, // Family (IPv4)
        0x30, // Port
        0x39,
        0xc9, // Address
        0xc7,
        0xc5,
        0x59,
      ]),
    );
  });
  it("encodes IPv6 MAPPED-ADDRESS value", () => {
    const value: MappedAddressAttr["value"] = {
      family: "IPv6",
      port: 12345,
      address: "2001:0:0:db8::1",
    };
    expect(encodeMappedAddressValue(value)).toEqual(
      Buffer.from([
        0x00,
        0x02, // Family (IPv6)
        0x30, // Port
        0x39,
        0x20, // Address
        0x01,
        0x00,
        0x00,
        0x00,
        0x00,
        0x0d,
        0xb8,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x01,
      ]),
    );
  });
});
describe("decodeMappedAddressValue", () => {
  it("throws an error if an invalid address family given", () => {
    const buf = Buffer.from([
      0x00,
      0x00, // invalid Family
      0x30, // Port
      0x39,
      0xc9, // Address
      0xc7,
      0xc5,
      0x59,
    ]);
    expect(() => decodeMappedAddressValue(buf)).toThrowError(
      /invalid address family/,
    );
  });
  it("decodes IPv4 MAPPED-ADDRESS value", () => {
    const buf = Buffer.from([
      0x00,
      0x01, // Family: IPv4
      0x30, // Port
      0x39,
      0xc9, // Address
      0xc7,
      0xc5,
      0x59,
    ]);
    expect(decodeMappedAddressValue(buf)).toEqual({
      family: "IPv4",
      port: 12345,
      address: "201.199.197.89",
    } satisfies MappedAddressAttr["value"]);
  });
  it("decodes IPv6 MAPPED-ADDRESS value", () => {
    const buf = Buffer.from([
      0x00,
      0x02, // Family: IPv4
      0x30, // Port
      0x39,
      0x20, // Address
      0x01,
      0x00,
      0x00,
      0x00,
      0x00,
      0x0d,
      0xb8,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
      0x01,
    ]);
    expect(decodeMappedAddressValue(buf)).toEqual({
      family: "IPv6",
      port: 12345,
      address: "2001:0000:0000:0db8:0000:0000:0000:0001",
    } satisfies MappedAddressAttr["value"]);
  });
});

describe("encodeXorMappedAddressValue", () => {
  it("encodes IPv4 XOR-MAPPED-ADDRESS value", () => {
    const trxId = Buffer.from([
      0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
    ]);
    const value: XorMappedAddressAttr["value"] = {
      family: "IPv4",
      port: 12345,
      address: "201.199.197.89",
    };
    expect(encodeXorMappedAddressValue(value, trxId)).toEqual(
      Buffer.from([
        0x00,
        0x01, // Family (IPv4)
        0x11, // X-Port
        0x2b,
        0xe8, // X-Address (IPv4)
        0xd5,
        0x61,
        0x1b,
      ]),
    );
  });
  it("encodes IPv6 XOR-MAPPED-ADDRESS value", () => {
    const trxId = Buffer.from([
      0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
    ]);
    const value: XorMappedAddressAttr["value"] = {
      family: "IPv6",
      port: 12345,
      address: "2001:0:0:db8::1",
    };
    expect(encodeXorMappedAddressValue(value, trxId)).toEqual(
      Buffer.from([
        0x00,
        0x02, // Family (IPv6)
        0x11, // X-Port
        0x2b,
        0x01, // X-Address (IPv6)
        0x13,

        0xa4,
        0x42,

        0x81,
        0x4c,

        0x7f,
        0xb1,

        0xa7,
        0x68,

        0xf9,
        0x89,

        0xf8,
        0x0b,

        0x73,
        0xbc,
      ]),
    );
  });
});
describe("decodeXorMappedAddressValue", () => {
  it("throws an error if an invalid address family given", () => {
    const header: Header = {
      cls: classRecord.request,
      method: methodRecord.binding,
      length: 8, // bytes
      magicCookie,
      trxId: Buffer.from([
        0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
      ]),
    };
    const buf = Buffer.from([
      0x00,
      0x00, // invalid Family
      0x11, // Port
      0x2b,
      0xe8, // X-Address (IPv4)
      0xd5,
      0x61,
      0x1b,
    ]);
    expect(() => decodeXorMappedAddressValue(buf, header)).toThrowError(
      /invalid address family/,
    );
  });
  it("decodes IPv4 XOR-MAPPED-ADDRESS value", () => {
    const header: Header = {
      cls: classRecord.request,
      method: methodRecord.binding,
      length: 8, // bytes
      magicCookie,
      trxId: Buffer.from([
        0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
      ]),
    };
    const buf = Buffer.from([
      0x00,
      0x01, // Family: IPv4
      0x11, // Port
      0x2b,
      0xe8, // X-Address (IPv4)
      0xd5,
      0x61,
      0x1b,
    ]);
    expect(decodeXorMappedAddressValue(buf, header)).toEqual({
      family: "IPv4",
      port: 12345,
      address: "201.199.197.89",
    } satisfies XorMappedAddressAttr["value"]);
  });
  it("decodes IPv6 XOR-MAPPED-ADDRESS value", () => {
    const header: Header = {
      cls: classRecord.request,
      method: methodRecord.binding,
      length: 20, // bytes
      magicCookie,
      trxId: Buffer.from([
        0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
      ]),
    };
    const buf = Buffer.from([
      0x00,
      0x02, // Family: IPv6
      0x11, // X-Port
      0x2b,
      0x01, // X-Address (IPv6)
      0x13,

      0xa4,
      0x42,

      0x81,
      0x4c,

      0x7f,
      0xb1,

      0xa7,
      0x68,

      0xf9,
      0x89,

      0xf8,
      0x0b,

      0x73,
      0xbc,
    ]);
    expect(decodeXorMappedAddressValue(buf, header)).toEqual({
      family: "IPv6",
      port: 12345,
      address: "2001:0000:0000:0db8:0000:0000:0000:0001",
    } satisfies XorMappedAddressAttr["value"]);
  });
});

describe("encodeErrorCodeValue", () => {
  it("throws an error if the given code is not in [300, 699]", () => {
    const value: ErrorCodeAttr["value"] = {
      code: 700,
      reason: "invalid attr type",
    };
    expect(() => encodeErrorCodeValue(value)).toThrowError(
      /invalid error code/,
    );
  });
  it("throws an error if the given reason is not <= 763 bytes", () => {
    const value: ErrorCodeAttr["value"] = {
      code: 420,
      reason: "a".repeat(764),
    };
    expect(() => encodeErrorCodeValue(value)).toThrowError(
      /invalid reason phrase/,
    );
  });
  it("encodes ERROR-CODE value", () => {
    const value: ErrorCodeAttr["value"] = {
      code: 420,
      reason: "invalid attr type", // 17 bytes
    };
    expect(encodeErrorCodeValue(value)).toEqual(
      Buffer.from([
        0x00,
        0x00,
        0x04, // Class
        0x14, // Number
        // Reason Phrase
        0x69,
        0x6e,
        0x76,
        0x61,
        0x6c,
        0x69,
        0x64,
        0x20,
        0x61,
        0x74,
        0x74,
        0x72,
        0x20,
        0x74,
        0x79,
        0x70,
        0x65,
      ]),
    );
  });
});
describe("decodeErrorCodeValue", () => {
  it("throws an error if the error class is not in [3, 6]", () => {
    const buf = Buffer.from([
      0x00,
      0x00,
      0x07, // Class
      0x14, // Number
      // Reason Phrase
      0x69,
      0x6e,
      0x76,
      0x61,
      0x6c,
      0x69,
      0x64,
      0x20,
      0x61,
      0x74,
      0x74,
      0x72,
      0x20,
      0x74,
      0x79,
      0x70,
      0x65,
    ]);
    expect(() => decodeErrorCodeValue(buf)).toThrowError(/invalid error class/);
  });
  it("throws an error if the error number is not in [0, 99]", () => {
    const buf = Buffer.from([
      0x00,
      0x00,
      0x04, // Class
      0x64, // Number
      // Reason Phrase
      0x69,
      0x6e,
      0x76,
      0x61,
      0x6c,
      0x69,
      0x64,
      0x20,
      0x61,
      0x74,
      0x74,
      0x72,
      0x20,
      0x74,
      0x79,
      0x70,
      0x65,
    ]);
    expect(() => decodeErrorCodeValue(buf)).toThrowError(
      /invalid error number/,
    );
  });
  it("throws an error if the reason phrase is not <= 763 bytes", () => {
    const buf = Buffer.concat([
      Buffer.from([
        0x00,
        0x00,
        0x04, // Class
        0x14, // Number
      ]),
      Buffer.from("a".repeat(764)),
    ]);
    expect(() => decodeErrorCodeValue(buf)).toThrowError(
      /invalid reason phrase/,
    );
  });
  it("decodes ERROR-CODE value", () => {
    const buf = Buffer.from([
      0x00,
      0x00,
      0x04, // Class
      0x14, // Number
      // Reason Phrase
      0x69,
      0x6e,
      0x76,
      0x61,
      0x6c,
      0x69,
      0x64,
      0x20,
      0x61,
      0x74,
      0x74,
      0x72,
      0x20,
      0x74,
      0x79,
      0x70,
      0x65,
    ]);
    expect(decodeErrorCodeValue(buf)).toEqual({
      code: 420,
      reason: "invalid attr type",
    });
  });
});

describe("encodeUsernameValue", () => {
  it("encodes USERNAME value", () => {
    const value: UsernameAttr["value"] = "user1";
    const res = encodeUsernameValue(value);
    expect(res).toEqual(Buffer.from([0x75, 0x73, 0x65, 0x72, 0x31]));
  });
  it("throws an error if the given username is not < 513 bytes", () => {
    const value: UsernameAttr["value"] = "u".repeat(513);
    expect(() => encodeUsernameValue(value)).toThrowError(/invalid username/);
  });
});

describe("decodeUsernameValue", () => {
  it("decodes USERNAME value", () => {
    const buf = Buffer.from([0x75, 0x73, 0x65, 0x72, 0x31]);
    const res = decodeUsernameValue(buf);
    expect(res).toEqual("user1");
  });
});

describe("encodeRealmValue", () => {
  it("encodes REALM value", () => {
    const value: RealmAttr["value"] = "realm";
    const res = encodeRealmValue(value);
    expect(res).toEqual(Buffer.from([0x72, 0x65, 0x61, 0x6c, 0x6d]));
  });
  it("throws an error if the given realm is not <= 763 bytes", () => {
    const value: RealmAttr["value"] = "r".repeat(764);
    expect(() => encodeRealmValue(value)).toThrowError(/invalid realm/);
  });
});

describe("decodeRealmValue", () => {
  it("decodes REALM value", () => {
    const buf = Buffer.from([0x72, 0x65, 0x61, 0x6c, 0x6d]);
    const res = decodeRealmValue(buf);
    expect(res).toEqual("realm");
  });
});

describe("encodeNonceValue", () => {
  it("encodes NONCE value", () => {
    const value: NonceAttr["value"] = "nonce";
    const res = encodeNonceValue(value);
    expect(res).toEqual(Buffer.from([0x6e, 0x6f, 0x6e, 0x63, 0x65]));
  });
  it("throws an error if the given nonce is not <= 763 bytes", () => {
    const value: NonceAttr["value"] = "n".repeat(764);
    expect(() => encodeNonceValue(value)).toThrowError(/invalid nonce/);
  });
});

describe("decodeNonceValue", () => {
  it("decodes Nonce value", () => {
    const buf = Buffer.from([0x6e, 0x6f, 0x6e, 0x63, 0x65]);
    const res = decodeNonceValue(buf);
    expect(res).toEqual("nonce");
  });
});

describe("encodeAttr", () => {
  it("encodes an attribute", () => {
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
    const res = encodeAttr(
      {
        type: "XOR-MAPPED-ADDRESS",
        value: {
          family: "IPv4",
          port: 12345,
          address: "201.199.197.89",
        },
      },
      hBuf as RawStunMsg,
    );
    expect(res).toEqual(
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
    );
  });
});

describe("decodeAttrs", () => {
  it("throws an error if the value length is not enough", () => {
    const header: Header = {
      cls: classRecord.request,
      method: methodRecord.binding,
      length: 11,
      magicCookie,
      trxId: Buffer.from([
        0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
      ]),
    };
    const buf = Buffer.from([
      0x00, // Type: XOR-MAPPED-ADDRESS
      0x20,
      0x00, // Length: 8 bytes
      0x08,
      // Value: 8 - 1 bytes
      0x00,
      0x01, // Family: IPv4
      0x11, // X-Port
      0x2b,
      0xff, // X-Address (IPv4)
      0x2c,
      0x53,
      // 0x04,	-1 bytes
    ]);
    expect(() => decodeAttrs(buf, header)).toThrowError(/invalid attr length/);
  });
  // TODO: Decode multiple attrs.
  it("decodes attrs", () => {
    const header: Header = {
      cls: classRecord.request,
      method: methodRecord.binding,
      length: 12,
      magicCookie,
      trxId: Buffer.from([
        0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
      ]),
    };
    const buf = Buffer.from([
      0x00, // Type: XOR-MAPPED-ADDRESS
      0x20,
      0x00, // Length: 8 bytes
      0x08,
      // Value: 8 bytes
      0x00,
      0x01, // Family: IPv4
      0x11, // X-Port
      0x2b,
      0xe8, // X-Address (IPv4)
      0xd5,
      0x61,
      0x1b,
    ]); // 12 bytes
    expect(decodeAttrs(buf, header)).toEqual([
      {
        type: "XOR-MAPPED-ADDRESS",
        length: 8,
        value: {
          family: "IPv4",
          port: 12345,
          address: "201.199.197.89",
        },
      },
    ] satisfies OutputAttr[]);
  });
});
