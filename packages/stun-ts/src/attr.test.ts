import { describe, expect, it } from "vitest";
import {
  type InputErrorCodeAttr,
  type InputMappedAddressAttr,
  type InputNonceAttr,
  type InputRealmAttr,
  type InputUnknownAttributesAttr,
  type InputUsernameAttr,
  type InputXorMappedAddressAttr,
  type OutputAttr,
  attrTypeRecord,
  attrValueDecoders,
  buildAttrsDecoder,
  decodeErrorCodeValue,
  decodeMappedAddressValue,
  decodeNonceValue,
  decodeRealmValue,
  decodeUnknownAttributeValue,
  decodeUsernameValue,
  decodeXorMappedAddressValue,
  encodeErrorCodeValue,
  encodeMappedAddressValue,
  encodeNonceValue,
  encodeRealmValue,
  encodeUnknownAttributesValue,
  encodeUsernameValue,
  encodeXorMappedAddressValue,
} from "./attr.js";
import { magicCookie } from "./consts.js";
import { type Header, encodeHeader } from "./header.js";
import type { RawStunMsg } from "./types.js";

describe("encodeMappedAddressValue", () => {
  it("encodes IPv4 MAPPED-ADDRESS value", () => {
    const value: InputMappedAddressAttr["value"] = {
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
    const value: InputMappedAddressAttr["value"] = {
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
    } satisfies InputMappedAddressAttr["value"]);
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
    } satisfies InputMappedAddressAttr["value"]);
  });
});

describe("encodeXorMappedAddressValue", () => {
  it("encodes IPv4 XOR-MAPPED-ADDRESS value", () => {
    const trxId = Buffer.from([
      0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
    ]);
    const hBuf = encodeHeader({
      cls: "Request",
      method: "Binding",
      length: 8,
      trxId,
    });
    const value: InputXorMappedAddressAttr["value"] = {
      family: "IPv4",
      port: 12345,
      address: "201.199.197.89",
    };
    expect(encodeXorMappedAddressValue(value, hBuf as RawStunMsg)).toEqual(
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
    const hBuf = encodeHeader({
      cls: "Request",
      method: "Binding",
      length: 8,
      trxId,
    });
    const value: InputXorMappedAddressAttr["value"] = {
      family: "IPv6",
      port: 12345,
      address: "2001:0:0:db8::1",
    };
    expect(encodeXorMappedAddressValue(value, hBuf as RawStunMsg)).toEqual(
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
      cls: "Request",
      method: "Binding",
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
      cls: "Request",
      method: "Binding",
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
    } satisfies InputXorMappedAddressAttr["value"]);
  });
  it("decodes IPv6 XOR-MAPPED-ADDRESS value", () => {
    const header: Header = {
      cls: "Request",
      method: "Binding",
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
    } satisfies InputXorMappedAddressAttr["value"]);
  });
});

describe("encodeErrorCodeValue", () => {
  it("throws an error if the given code is not in [300, 699]", () => {
    const value: InputErrorCodeAttr["value"] = {
      code: 700,
      reason: "invalid attr type",
    };
    expect(() => encodeErrorCodeValue(value)).toThrowError(
      /invalid error code/,
    );
  });
  it("throws an error if the given reason is not <= 763 bytes", () => {
    const value: InputErrorCodeAttr["value"] = {
      code: 420,
      reason: "a".repeat(764),
    };
    expect(() => encodeErrorCodeValue(value)).toThrowError(
      /invalid reason phrase/,
    );
  });
  it("encodes ERROR-CODE value", () => {
    const value: InputErrorCodeAttr["value"] = {
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
    const value: InputUsernameAttr["value"] = "user1";
    const res = encodeUsernameValue(value);
    expect(res).toEqual(Buffer.from([0x75, 0x73, 0x65, 0x72, 0x31]));
  });
  it("throws an error if the given username is not < 513 bytes", () => {
    const value: InputUsernameAttr["value"] = "u".repeat(513);
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
    const value: InputRealmAttr["value"] = "realm";
    const res = encodeRealmValue(value);
    expect(res).toEqual(Buffer.from([0x72, 0x65, 0x61, 0x6c, 0x6d]));
  });
  it("throws an error if the given realm is not <= 763 bytes", () => {
    const value: InputRealmAttr["value"] = "r".repeat(764);
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
    const value: InputNonceAttr["value"] = "nonce";
    const res = encodeNonceValue(value);
    expect(res).toEqual(Buffer.from([0x6e, 0x6f, 0x6e, 0x63, 0x65]));
  });
  it("throws an error if the given nonce is not <= 763 bytes", () => {
    const value: InputNonceAttr["value"] = "n".repeat(764);
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

describe("encodeUnknownAttributesValue", () => {
  it("encodes UNKNOWN-ATTRIBUTES value", () => {
    const value: InputUnknownAttributesAttr["value"] = [0x0002, 0x0003, 0x0004];
    const res = encodeUnknownAttributesValue(value);

    // should be aligned by multiple of 4 bytes
    expect(res).toEqual(
      Buffer.from([
        0x00, // Attr Type 1
        0x02,
        0x00, // Attr Type 2
        0x03,
        0x00, // Attr Type 3
        0x04,
        0, // Paddings
        0,
      ]),
    );
  });
});

describe("decodeUnknownAttributesValue", () => {
  it("decodes UNKNOWN-ATTRIBUTES value", () => {
    const buf = Buffer.from([
      0x00, // Attr Type 1
      0x02,
      0x00, // Attr Type 2
      0x03,
      0x00, // Attr Type 3
      0x04,
      0, // Paddings
      0,
    ]);
    const res = decodeUnknownAttributeValue(buf);
    expect(res).toEqual([0x0002, 0x0003, 0x0004]);
  });
});

describe("buildAttrsDecoder", () => {
  const ctx = {
    attrsDecoder: buildAttrsDecoder<OutputAttr>(
      attrTypeRecord,
      attrValueDecoders,
    ),
  };
  it("throws an error if the value length is not enough", () => {
    const header: Header = {
      cls: "Request",
      method: "Binding",
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
    expect(() => ctx.attrsDecoder(buf, header)).toThrowError(
      /invalid attr length/,
    );
  });
  // TODO: Decode multiple attrs.
  it("decodes attrs", () => {
    const header: Header = {
      cls: "Request",
      method: "Binding",
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
    expect(ctx.attrsDecoder(buf, header)).toEqual([
      {
        type: "XOR-MAPPED-ADDRESS",
        value: {
          family: "IPv4",
          port: 12345,
          address: "201.199.197.89",
        },
      },
    ] satisfies OutputAttr[]);
  });
});
