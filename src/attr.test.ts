import { describe, expect, it } from "vitest";
import {
  type Attr,
  type ErrorCodeAttr,
  type MappedAddressAttr,
  type UsernameAttr,
  type XorMappedAddressAttr,
  addrFamilyRecord,
  compReqAttrTypeRecord,
  decodeAttrs,
  decodeErrorCodeValue,
  decodeMappedAddressValue,
  decodeUsernameValue,
  decodeXorMappedAddressValue,
  encodeAttr,
  encodeErrorCodeValue,
  encodeMappedAddressValue,
  encodeUsernameValue,
  encodeXorMappedAddressValue,
} from "./attr.js";
import { magicCookie } from "./consts.js";
import { type Header, classRecord, methodRecord } from "./header.js";

describe("encodeMappedAddressValue", () => {
  it("encodes IPv4 MAPPED-ADDRESS value", () => {
    const value: MappedAddressAttr["value"] = {
      family: addrFamilyRecord.ipV4,
      port: 12345,
      addr: Buffer.from([0xc9, 0xc7, 0xc5, 0x59]),
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
      family: addrFamilyRecord.ipV6,
      port: 12345,
      addr: Buffer.from([
        0xde, 0x3e, 0xf7, 0x46, 0x70, 0x0f, 0x21, 0xb2, 0x0f, 0xf4, 0xf4, 0x2e,
        0x93, 0x47, 0x61, 0x2c,
      ]),
    };
    expect(encodeMappedAddressValue(value)).toEqual(
      Buffer.from([
        0x00,
        0x02, // Family (IPv6)
        0x30, // Port
        0x39,
        0xde, //  Address
        0x3e,
        0xf7,
        0x46,
        0x70,
        0x0f,
        0x21,
        0xb2,
        0x0f,
        0xf4,
        0xf4,
        0x2e,
        0x93,
        0x47,
        0x61,
        0x2c,
      ]),
    );
  });
});
describe("decodeMappedAddressValue", () => {
  it("throws an error if an invalid address family given", () => {
    const buf = Buffer.from([
      0x00,
      0x00, // invalid Family
      0x10, // Port
      0x01,
      0x10, // Address (IPv4)
      0x11,
      0x00,
      0x01,
    ]);
    expect(() => decodeMappedAddressValue(buf)).toThrowError(
      /invalid address family/,
    );
  });
  it("decodes IPv4 MAPPED-ADDRESS value", () => {
    const buf = Buffer.from([
      0x00,
      0x01, // Family: IPv4
      0x10, // Port
      0x01,
      0x10, // Address (32 bits)
      0x11,
      0x00,
      0x01,
    ]);
    expect(decodeMappedAddressValue(buf)).toEqual({
      family: 0x01,
      port: 0x1001,
      addr: Buffer.from([0x10, 0x11, 0x00, 0x01]),
    } satisfies MappedAddressAttr["value"]);
  });
  it("decodes IPv6 MAPPED-ADDRESS value", () => {
    const buf = Buffer.from([
      0x00,
      0x02, // Family: IPv4
      0x10, // Port
      0x01,
      0x10, // Address (128 bits)
      0x11,
      0x00,
      0x01,

      0x10,
      0x11,
      0x00,
      0x01,

      0x10,
      0x11,
      0x00,
      0x01,

      0x10,
      0x11,
      0x00,
      0x01,
    ]);
    expect(decodeMappedAddressValue(buf)).toEqual({
      family: 0x02,
      port: 0x1001,
      addr: Buffer.from([
        0x10, 0x11, 0x00, 0x01, 0x10, 0x11, 0x00, 0x01, 0x10, 0x11, 0x00, 0x01,
        0x10, 0x11, 0x00, 0x01,
      ]),
    } satisfies MappedAddressAttr["value"]);
  });
});

describe("encodeXorMappedAddressValue", () => {
  it("encodes IPv4 XOR-MAPPED-ADDRESS value", () => {
    const trxId = Buffer.from([
      0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
    ]);
    const value: XorMappedAddressAttr["value"] = {
      family: addrFamilyRecord.ipV4,
      port: 12345,
      addr: Buffer.from([0xde, 0x3e, 0xf7, 0x46]),
    };
    expect(encodeXorMappedAddressValue(value, trxId)).toEqual(
      Buffer.from([
        0x00,
        0x01, // Family (IPv4)
        0x11, // Port
        0x2b,
        0xff, // X-Address (IPv4)
        0x2c,
        0x53,
        0x04,
      ]),
    );
  });
  it("encodes IPv6 XOR-MAPPED-ADDRESS value", () => {
    const trxId = Buffer.from([
      0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
    ]);
    const value: XorMappedAddressAttr["value"] = {
      family: addrFamilyRecord.ipV6,
      port: 12345,
      addr: Buffer.from([
        0xde, 0x3e, 0xf7, 0x46, 0x70, 0x0f, 0x21, 0xb2, 0x0f, 0xf4, 0xf4, 0x2e,
        0x93, 0x47, 0x61, 0x2c,
      ]),
    };
    expect(encodeXorMappedAddressValue(value, trxId)).toEqual(
      Buffer.from([
        0x00,
        0x02, // Family (IPv6)
        0x11, // X-Port
        0x2b,
        0xff, // X-Address (IPv6)
        0x2c,
        0x53,
        0x04,

        0xf1,
        0x43,
        0x53,
        0xbb,

        0xa8,
        0x9c,
        0x0d,
        0xa7,

        0x6b,
        0x4c,
        0x12,
        0x91,
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
      0x10, // X-Port
      0x01,
      0x10, // X-Address (IPv4)
      0x11,
      0x00,
      0x01,
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
      0x10, // X-Port
      0x01,

      0xff, // X-Address (IPv4)
      0x2c,
      0x53,
      0x04,
    ]);
    expect(decodeXorMappedAddressValue(buf, header)).toEqual({
      family: 0x01,
      port: 0x3113,
      addr: Buffer.from([0xde, 0x3e, 0xf7, 0x46]),
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
      0x10, // X-Port
      0x01,

      0xff, // X-Address (IPv6)
      0x2c,
      0x53,
      0x04,

      0xf1,
      0x43,
      0x53,
      0xbb,

      0xa8,
      0x9c,
      0x0d,
      0xa7,

      0x6b,
      0x4c,
      0x12,
      0x91,
    ]);
    expect(decodeXorMappedAddressValue(buf, header)).toEqual({
      family: 0x02,
      port: 0x3113,
      addr: Buffer.from([
        0xde, 0x3e, 0xf7, 0x46, 0x70, 0x0f, 0x21, 0xb2, 0x0f, 0xf4, 0xf4, 0x2e,
        0x93, 0x47, 0x61, 0x2c,
      ]),
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
    const value: UsernameAttr["value"] = {
      username: "user1",
    };
    const res = encodeUsernameValue(value);
    expect(res).toEqual(Buffer.from([0x75, 0x73, 0x65, 0x72, 0x31]));
  });
  it("throws an error if the given username is not < 513 bytes", () => {
    const value: UsernameAttr["value"] = {
      username: "u".repeat(513),
    };
    expect(() => encodeUsernameValue(value)).toThrowError(/invalid username/);
  });
});

describe("decodeUsernameValue", () => {
  it("decodes USERNAME value", () => {
    const buf = Buffer.from([0x75, 0x73, 0x65, 0x72, 0x31]);
    const res = decodeUsernameValue(buf);
    expect(res).toEqual({
      username: "user1",
    } satisfies UsernameAttr["value"]);
  });
});

describe("encodeAttr", () => {
  it("encodes an attribute", () => {
    const trxId = Buffer.from([
      0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
    ]);
    const res = encodeAttr(
      {
        type: compReqAttrTypeRecord["XOR-MAPPED-ADDRESS"],
        value: {
          family: addrFamilyRecord.ipV4,
          addr: Buffer.from([0xde, 0x3e, 0xf7, 0x46]),
          port: 12345,
        },
      },
      trxId,
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
        0xff, // X-Address (IPv4)
        0x2c,
        0x53,
        0x04,
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
      0x10, // X-Port
      0x01,
      0xff, // X-Address (IPv4)
      0x2c,
      0x53,
      // 0x04,	-1 bytes
    ]);
    expect(() => decodeAttrs(buf, header)).toThrowError(/invalid attr length/);
  });
  // TODO: Decode multiple attrs.
  it("docodes attrs", () => {
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
      0x10, // X-Port
      0x01,
      0xff, // X-Address (IPv4)
      0x2c,
      0x53,
      0x04,
    ]); // 12 bytes
    expect(decodeAttrs(buf, header)).toEqual([
      {
        type: compReqAttrTypeRecord["XOR-MAPPED-ADDRESS"],
        length: 8,
        value: {
          family: addrFamilyRecord.ipV4,
          port: 0x3113,
          addr: Buffer.from([0xde, 0x3e, 0xf7, 0x46]),
        },
      },
    ] satisfies Attr[]);
  });
});
