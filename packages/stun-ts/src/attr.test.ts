import { describe, expect, it } from "vitest";
import {
  decodeChannelNumberValue,
  decodeErrorCodeValue,
  decodeLifetimeValue,
  decodeMappedAddressValue,
  decodeNonceValue,
  decodeRealmValue,
  decodeRequestedTransportValue,
  decodeUnknownAttributeValue,
  decodeUsernameValue,
  decodeXorAddressValue,
  encodeChannelNumberValue,
  encodeErrorCodeValue,
  encodeLifetimeValue,
  encodeMappedAddressValue,
  encodeNonceValue,
  encodeRealmValue,
  encodeRequestedTransportValue,
  encodeUnknownAttributesValue,
  encodeUsernameValue,
  encodeXorAddressValue,
} from "./attr.js";

const ctx: {
  trxId: Buffer;
} = {
  trxId: Buffer.from([
    0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
  ]),
} as const;

describe("MAPPED-ADDRESS", () => {
  describe("encodeMappedAddressValue", () => {
    it("encodes IPv4 MAPPED-ADDRESS value", () => {
      expect(
        encodeMappedAddressValue({
          family: "IPv4",
          port: 12345,
          address: "201.199.197.89",
        }),
      ).toEqual(
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
      expect(
        encodeMappedAddressValue({
          family: "IPv6",
          port: 12345,
          address: "2001:0:0:db8::1",
        }),
      ).toEqual(
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
      } satisfies ReturnType<typeof decodeMappedAddressValue>);
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
      } satisfies ReturnType<typeof decodeMappedAddressValue>);
    });
  });
});

describe("XOR-MAPPED-ADDRESS/XOR-PEER-ADDRESS/XOR-RELAYED-ADDRESS", () => {
  describe("encodeXorAddressValue", () => {
    it("encodes IPv4 XOR-XXX-ADDRESS value", () => {
      expect(
        encodeXorAddressValue({
          family: "IPv4",
          port: 12345,
          address: "201.199.197.89",
          trxId: ctx.trxId,
        }),
      ).toEqual(
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
    it("encodes IPv6 XOR-XXX-ADDRESS value", () => {
      expect(
        encodeXorAddressValue({
          family: "IPv6",
          port: 12345,
          address: "2001:0:0:db8::1",
          trxId: ctx.trxId,
        }),
      ).toEqual(
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
  describe("decodeXorAddressValue", () => {
    it("throws an error if an invalid address family given", () => {
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
      expect(() => decodeXorAddressValue(buf, ctx.trxId)).toThrowError(
        /invalid address family/,
      );
    });
    it("decodes IPv4 XOR-XXX-ADDRESS value", () => {
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
      expect(decodeXorAddressValue(buf, ctx.trxId)).toEqual({
        family: "IPv4",
        port: 12345,
        address: "201.199.197.89",
      } satisfies ReturnType<typeof decodeXorAddressValue>);
    });
    it("decodes IPv6 XOR-XXX-ADDRESS value", () => {
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
      expect(decodeXorAddressValue(buf, ctx.trxId)).toEqual({
        family: "IPv6",
        port: 12345,
        address: "2001:0000:0000:0db8:0000:0000:0000:0001",
      } satisfies ReturnType<typeof decodeXorAddressValue>);
    });
  });
});

describe("ERROR-CODE", () => {
  describe("encodeErrorCodeValue", () => {
    it("throws an error if the given code is not in [300, 699]", () => {
      expect(() =>
        encodeErrorCodeValue({
          code: 700,
          reason: "invalid attr type",
        }),
      ).toThrowError(/invalid error code/);
    });
    it("throws an error if the given reason is not <= 763 bytes", () => {
      expect(() =>
        encodeErrorCodeValue({
          code: 420,
          reason: "a".repeat(764),
        }),
      ).toThrowError(/invalid reason phrase/);
    });
    it("encodes ERROR-CODE value", () => {
      expect(
        encodeErrorCodeValue({
          code: 420,
          reason: "invalid attr type", // 17 bytes
        }),
      ).toEqual(
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
      expect(() => decodeErrorCodeValue(buf)).toThrowError(
        /invalid error class/,
      );
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
});

describe("NONCE", () => {
  describe("encodeNonceValue", () => {
    it("encodes NONCE value", () => {
      const res = encodeNonceValue("nonce");
      expect(res).toEqual(Buffer.from([0x6e, 0x6f, 0x6e, 0x63, 0x65]));
    });
    it("throws an error if the given nonce is not <= 763 bytes", () => {
      expect(() => encodeNonceValue("n".repeat(764))).toThrowError(
        /invalid nonce/,
      );
    });
  });
  describe("decodeNonceValue", () => {
    it("decodes Nonce value", () => {
      const buf = Buffer.from([0x6e, 0x6f, 0x6e, 0x63, 0x65]);
      const res = decodeNonceValue(buf);
      expect(res).toEqual("nonce");
    });
  });
});

describe("USERNAME", () => {
  describe("encodeUsernameValue", () => {
    it("encodes USERNAME value", () => {
      const res = encodeUsernameValue("user1");
      expect(res).toEqual(Buffer.from([0x75, 0x73, 0x65, 0x72, 0x31]));
    });
    it("throws an error if the given username is not < 513 bytes", () => {
      expect(() => encodeUsernameValue("u".repeat(513))).toThrowError(
        /invalid username/,
      );
    });
  });
  describe("decodeUsernameValue", () => {
    it("decodes USERNAME value", () => {
      const buf = Buffer.from([0x75, 0x73, 0x65, 0x72, 0x31]);
      const res = decodeUsernameValue(buf);
      expect(res).toEqual("user1");
    });
  });
});

describe("REALM", () => {
  describe("encodeRealmValue", () => {
    it("encodes REALM value", () => {
      const res = encodeRealmValue("realm");
      expect(res).toEqual(Buffer.from([0x72, 0x65, 0x61, 0x6c, 0x6d]));
    });
    it("throws an error if the given realm is not <= 763 bytes", () => {
      expect(() => encodeRealmValue("r".repeat(764))).toThrowError(
        /invalid realm/,
      );
    });
  });
  describe("decodeRealmValue", () => {
    it("decodes REALM value", () => {
      const buf = Buffer.from([0x72, 0x65, 0x61, 0x6c, 0x6d]);
      const res = decodeRealmValue(buf);
      expect(res).toEqual("realm");
    });
  });
});

describe("UNKNOWN-ATTRIBUTES", () => {
  describe("encodeUnknownAttributesValue", () => {
    it("encodes UNKNOWN-ATTRIBUTES value", () => {
      const res = encodeUnknownAttributesValue([0x0002, 0x0003, 0x0004]);

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
});

describe("CHANNEL-NUMBER", () => {
  describe("encodeChannelNumberValue", () => {
    it("encodes CHANNEL-NUMBER value", () => {
      const res = encodeChannelNumberValue(12345);
      expect(res).toEqual(Buffer.from([0x30, 0x39, 0x00, 0x00]));
    });
  });
  describe("decodeChannelNumberValue", () => {
    it("decodes CHANNEL-NUMBER value", () => {
      const buf = Buffer.from([0x30, 0x39, 0x00, 0x00]);
      const res = decodeChannelNumberValue(buf);
      expect(res).toEqual(12345);
    });
  });
});

describe("LIFETIME", () => {
  describe("encodeLifetimeValue", () => {
    it("encodes LIFETIME value", () => {
      const res = encodeLifetimeValue(3600);
      expect(res).toEqual(Buffer.from([0x00, 0x00, 0x0e, 0x10]));
    });
  });
  describe("decodeLifetimeValue", () => {
    it("decodes LIFETIME value", () => {
      const buf = Buffer.from([0x00, 0x00, 0x0e, 0x10]);
      const res = decodeLifetimeValue(buf);
      expect(res).toEqual(3600);
    });
  });
});

describe("REQUESTED-TRANSPORT", () => {
  describe("encodeRequestedTransportValue", () => {
    it("encodes REQUESTED-TRANSPORT value", () => {
      const res = encodeRequestedTransportValue("udp");
      expect(res).toEqual(Buffer.from([0x11, 0x00, 0x00, 0x00]));
    });
  });
  describe("decodeRequestedTransportValue", () => {
    it("decodes REQUESTED-TRANSPORT value", () => {
      const buf = Buffer.from([0x11, 0x00, 0x00, 0x00]);
      const res = decodeRequestedTransportValue(buf);
      expect(res).toEqual("udp");
    });
  });
});
