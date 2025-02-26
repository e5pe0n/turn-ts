import { type Override, assertValueOf, getKey } from "@e5pe0n/lib";
import { z } from "zod";
import {
  attrTypeRecord,
  decodeErrorCodeValue,
  decodeMappedAddressValue,
  decodeNonceValue,
  decodeRealmValue,
  decodeSoftwareValue,
  decodeUnknownAttributeValue,
  decodeUsernameValue,
  decodeXorMappedAddressValue,
  encodeErrorCodeValue,
  encodeMappedAddressValue,
  encodeNonceValue,
  encodeRealmValue,
  encodeSoftwareValue,
  encodeUnknownAttributesValue,
  encodeUsernameValue,
  encodeXorMappedAddressValue,
} from "./attr.js";
import { encodeFingerprintValue } from "./fingerprint.js";
import {
  credentialsSchema,
  encodeMessageIntegrityValue,
} from "./msg-integrity.js";
import { addrFamilySchema, magicCookie } from "./common.js";
import {
  type Header,
  type MsgClass,
  type MsgMethod,
  decodeHeader,
} from "./header.js";
import { RawStunMsgBuilder } from "./msg-builder.js";
import type { RawStunMsg } from "./types.js";

const inputAttrsSchema = z
  .object({
    mappedAddress: z.object({
      family: addrFamilySchema,
      port: z.number(),
      address: z.string().ip(),
    }),
    username: z.string(),
    errorCode: z.object({
      code: z.number(),
      reason: z.string(),
    }),
    unknownAttributes: z.array(z.number()),
    realm: z.string(),
    nonce: z.string(),
    xorMappedAddress: z.object({
      family: addrFamilySchema,
      port: z.number(),
      address: z.string().ip(),
    }),
    software: z.string(),
    messageIntegrity: credentialsSchema,
    fingerprint: z.boolean(),
  })
  .partial();

type InputAttrs = z.infer<typeof inputAttrsSchema>;

type Attrs = Override<
  InputAttrs,
  Partial<{ messageIntegrity: Buffer; fingerprint: Buffer }>
>;

export type StunMsg = {
  // TODO: hide magicCookie from users
  header: Header;
  attrs: Attrs;
  raw: RawStunMsg;
};

export const StunMsg = {
  build({
    header,
    attrs,
  }: {
    header: {
      cls: MsgClass;
      method: MsgMethod;
      trxId: Buffer;
    };
    attrs?: InputAttrs | undefined;
  }): StunMsg {
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
          vBuf = encodeXorMappedAddressValue({
            ...inputAttrs[k],
            trxId: header.trxId,
          });
          break;
        case "messageIntegrity":
        case "fingerprint":
          continue;
        default:
          k satisfies never;
      }
      rawMsgBuilder.addAttr(k, vBuf);
    }

    const msgAttrs = inputAttrs as Attrs;
    if (inputAttrs.messageIntegrity) {
      const vBuf = encodeMessageIntegrityValue({
        credentials: inputAttrs.messageIntegrity,
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
    };
  },

  from(raw: Buffer): StunMsg {
    const buf = Buffer.from(raw);

    const header = decodeHeader(buf.subarray(0, 20));

    const attrsBuf = buf.subarray(20, 20 + header.length);
    let offset = 0;
    const attrs = {} as Attrs;
    while (offset + 4 <= attrsBuf.length) {
      const attrType = attrsBuf.subarray(offset, offset + 2).readUInt16BE();
      // TODO: Distinguish between comprehension-required attributes
      // and comprehension-optional attributes.
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
        case "username":
          attrs[kAttrType] = decodeUsernameValue(vBuf);
          break;
        case "errorCode":
          attrs[kAttrType] = decodeErrorCodeValue(vBuf);
          break;
        case "unknownAttributes":
          attrs[kAttrType] = decodeUnknownAttributeValue(vBuf);
          break;
        case "realm":
          attrs[kAttrType] = decodeRealmValue(vBuf);
          break;
        case "nonce":
          attrs[kAttrType] = decodeNonceValue(vBuf);
          break;
        case "software":
          attrs[kAttrType] = decodeSoftwareValue(vBuf);
          break;
        case "xorMappedAddress":
          attrs[kAttrType] = decodeXorMappedAddressValue(vBuf, header.trxId);
          break;
        case "messageIntegrity":
          attrs[kAttrType] = vBuf;
          break;
        case "fingerprint":
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
    };
  },
};
