import { expect, test } from "vitest";
import { encodeMessageIntegrityValue } from "./msg-integrity.js";
import { StunMsg } from "./msg.js";

const ctx: {
  trxId: Buffer;
} = {
  trxId: Buffer.from([
    0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
  ]),
};

test.each([
  {
    credentials: {
      term: "long",
      username: "user",
      realm: "realm",
      password: "pass",
    } as const,
  },
  {
    credentials: {
      term: "short",
      password: "pass",
    } as const,
  },
])(
  "message integrity should change if some part of a message has been modified: $credentials.term",
  ({ credentials }) => {
    const msg = StunMsg.build({
      header: {
        cls: "SuccessResponse",
        method: "Binding",
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
    const raw = msg.raw;

    const integrity1 = encodeMessageIntegrityValue({
      credentials,
      raw,
    });

    // modify the message
    raw.fill(0xff, 0, 1);

    const integrity2 = encodeMessageIntegrityValue({
      credentials,
      raw,
    });

    expect(integrity1).not.toEqual(integrity2);
  },
);
