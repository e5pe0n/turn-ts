import { assert, type Override, assertValueOf, getKey } from "@e5pe0n/lib";
import {
  type RawStunMsg,
  addrFamilySchema,
  decodeErrorCodeValue,
  decodeMappedAddressValue,
  decodeUnknownAttributesValue,
  encodeErrorCodeValue,
  encodeFingerprintValue,
  encodeMappedAddressValue,
  encodeMessageIntegrityValue,
  encodeNonceValue,
  encodeRealmValue,
  encodeSoftwareValue,
  encodeUnknownAttributesValue,
  encodeUsernameValue,
  encodeXorAddressValue,
  magicCookie,
  inputAttrsSchema as stunInputAttrsSchema,
} from "@e5pe0n/stun-ts";
import {
  decodeStrValue,
  decodeXorAddressValue,
} from "@e5pe0n/stun-ts/src/attr.js";
import { z } from "zod";
import {
  attrTypeRecord,
  decodeEvenPortValue,
  decodeLifetimeValue,
  decodeRequestedTransportValue,
  encodeEvenPortValue,
  encodeLifetimeValue,
  encodeRequestedTransportValue,
} from "./attr.js";
import { Header } from "./header.js";
import { type InitHeader, RawStunMsgBuilder } from "./msg-builder.js";

const addressSchema = z.object({
  family: addrFamilySchema,
  port: z.number(),
  address: z.string().ip(),
});

const inputAttrsSchema = stunInputAttrsSchema
  .strict()
  .merge(
    z.object({
      lifetime: z.number().int().nonnegative(),
      xorPeerAddress: addressSchema,
      data: z.instanceof(Buffer),
      xorRelayedAddress: addressSchema,
      evenPort: z.boolean(),
      requestedTransport: z.literal("udp"),
      dontFragment: z.literal(true),
      reservationToken: z.instanceof(Buffer),
    }),
  )
  .partial();

type InputAttrs = z.infer<typeof inputAttrsSchema>;

type Attrs = Override<InputAttrs, Partial<{ fingerprint: Buffer }>>;

export type TurnMsg = {
  // TODO: hide magicCookie from users
  header: Header;
  attrs: Attrs;
  raw: RawStunMsg;
  msgIntegrityOffset: number;
};

export const TurnMsg = {
  build({
    header,
    attrs = {},
    password,
  }: {
    header: InitHeader;
    attrs?: InputAttrs | undefined;
    password?: string | undefined;
  }): TurnMsg {
    // TODO: handle validation error
    const rawMsgBuilder = RawStunMsgBuilder.init(header);
    const inputAttrs = inputAttrsSchema.parse(attrs);
    for (const k of Object.keys(inputAttrs) as (keyof InputAttrs)[]) {
      if (inputAttrs[k] === undefined) {
        continue;
      }
      let vBuf = Buffer.alloc(0);
      switch (k) {
        case "mappedAddress":
          vBuf = encodeMappedAddressValue(inputAttrs[k]);
          break;
        case "username":
          vBuf = encodeUsernameValue(inputAttrs[k]);
          break;
        case "errorCode":
          vBuf = encodeErrorCodeValue(inputAttrs[k]);
          break;
        case "unknownAttributes":
          vBuf = encodeUnknownAttributesValue(inputAttrs[k]);
          break;
        case "realm":
          vBuf = encodeRealmValue(inputAttrs[k]);
          break;
        case "nonce":
          vBuf = encodeNonceValue(inputAttrs[k]);
          break;
        case "software":
          vBuf = encodeSoftwareValue(inputAttrs[k]);
          break;
        case "xorMappedAddress":
        case "xorPeerAddress":
        case "xorRelayedAddress":
          vBuf = encodeXorAddressValue({
            ...inputAttrs[k],
            trxId: header.trxId,
          });
          break;
        case "lifetime":
          vBuf = encodeLifetimeValue(inputAttrs[k]);
          break;
        case "requestedTransport":
          vBuf = encodeRequestedTransportValue(inputAttrs[k]);
          break;
        case "evenPort":
          vBuf = encodeEvenPortValue(inputAttrs[k]);
          break;
        case "data":
        case "reservationToken":
          vBuf = inputAttrs[k];
          break;
        case "dontFragment":
          break;
        case "messageIntegrity":
        case "fingerprint":
          continue;
        default:
          k satisfies never;
      }
      rawMsgBuilder.addAttr(k, vBuf);
    }

    const msgIntegrityOffset = rawMsgBuilder.raw.length;
    const msgAttrs = inputAttrs as Attrs;
    if (inputAttrs.messageIntegrity) {
      msgAttrs.messageIntegrity = inputAttrs.messageIntegrity;
      rawMsgBuilder.addAttr("messageIntegrity", inputAttrs.messageIntegrity);
    } else if (
      !inputAttrs.messageIntegrity &&
      inputAttrs.username &&
      inputAttrs.realm &&
      password
    ) {
      const vBuf = encodeMessageIntegrityValue({
        credentials: {
          term: "long",
          username: inputAttrs.username,
          realm: inputAttrs.realm,
          password,
        },
        raw: rawMsgBuilder.raw,
      });
      msgAttrs.messageIntegrity = vBuf;
      rawMsgBuilder.addAttr("messageIntegrity", vBuf);
    }
    if (inputAttrs.fingerprint) {
      const vBuf = encodeFingerprintValue(rawMsgBuilder.raw);
      msgAttrs.fingerprint = vBuf;
      rawMsgBuilder.addAttr("fingerprint", vBuf);
    }

    return {
      header: {
        ...header,
        length: rawMsgBuilder.msgLength,
        magicCookie,
      },
      attrs: msgAttrs,
      raw: rawMsgBuilder.raw,
      msgIntegrityOffset,
    };
  },

  from(raw: Buffer): TurnMsg {
    const buf = Buffer.from(raw);

    assert(
      raw.length >= 20,
      new Error(
        `invalid stun msg; expected msg length is >= 20 bytes. actual length is ${raw.length}.`,
      ),
    );
    assert(
      raw.length % 4 === 0,
      new Error(
        `invalid stun msg; expected msg length is a multiple of 4 bytes. actual length is ${raw.length}.`,
      ),
    );
    const fstBits = raw[0]! >>> 6;
    assert(
      fstBits === 0,
      new Error(
        `invalid stun msg; expected the most significant 2 bits is 0b00. actual is 0b${fstBits.toString(2)}.`,
      ),
    );

    const header = Header.from(buf.subarray(0, 20));

    const attrsBuf = buf.subarray(20, 20 + header.length);
    let offset = 0;
    let msgIntegrityOffset = -1;
    const attrs = {} as Attrs;
    while (offset + 4 <= attrsBuf.length) {
      const attrType = attrsBuf.subarray(offset, offset + 2).readUInt16BE();
      assertValueOf(
        attrType,
        attrTypeRecord,
        new Error(
          `invalid attr type; 0x${attrType.toString(16)} is not a valid attr type.`,
        ),
      );
      const kAttrType = getKey(attrTypeRecord, attrType);
      const length = attrsBuf.subarray(offset + 2, offset + 4).readUInt16BE();
      const restLength = attrsBuf.length - (offset + 4);
      if (!(restLength >= length)) {
        throw new Error(
          `invalid attr length; given ${kAttrType} value length is ${length}, but the actual remaining value length is ${restLength}.`,
        );
      }
      const vBuf = Buffer.alloc(
        length,
        attrsBuf.subarray(offset + 4, offset + 4 + length),
      );
      switch (kAttrType) {
        case "mappedAddress":
          attrs[kAttrType] = decodeMappedAddressValue(vBuf);
          break;
        case "errorCode":
          attrs[kAttrType] = decodeErrorCodeValue(vBuf);
          break;
        case "unknownAttributes":
          attrs[kAttrType] = decodeUnknownAttributesValue(vBuf);
          break;
        case "username":
        case "realm":
        case "nonce":
        case "software":
          attrs[kAttrType] = decodeStrValue(vBuf);
          break;
        case "xorMappedAddress":
        case "xorPeerAddress":
        case "xorRelayedAddress":
          attrs[kAttrType] = decodeXorAddressValue(vBuf, header.trxId);
          break;
        case "dontFragment":
          attrs[kAttrType] = true;
          break;
        case "lifetime":
          attrs[kAttrType] = decodeLifetimeValue(vBuf);
          break;
        case "evenPort":
          attrs[kAttrType] = decodeEvenPortValue(vBuf).reserveNextHigherPort;
          break;
        case "requestedTransport":
          attrs[kAttrType] = decodeRequestedTransportValue(vBuf);
          break;
        case "reservationToken":
        case "data":
        case "fingerprint":
          attrs[kAttrType] = vBuf;
          break;
        case "messageIntegrity":
          msgIntegrityOffset = offset;
          attrs[kAttrType] = vBuf;
          break;
        default:
          kAttrType satisfies never;
      }
      offset += 4 + length;
    }

    return {
      header,
      attrs,
      raw: buf as RawStunMsg,
      msgIntegrityOffset,
    };
  },
};
