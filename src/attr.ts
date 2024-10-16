import { createHash, createHmac } from "node:crypto";
import { magicCookie } from "./consts.js";
import type { Header } from "./header.js";
import {
  type ValueOf,
  assertValueOf,
  isValueOf,
  numToBuf,
  xorBufs,
} from "./helpers.js";
import {
  encodeStunMsg,
  type EncodeStunMsgParams,
  type StunMsg,
} from "./msg.js";

const compReqRange = [0x0000, 0x7fff] as const;
const compOptRange = [0x8000, 0xffff] as const;

export const compReqAttrTypeRecord = {
  "MAPPED-ADDRESS": 0x0001,
  USERNAME: 0x0006,
  "MESSAGE-INTEGRITY": 0x0008,
  "ERROR-CODE": 0x0009,
  "UNKNOWN-ATTRIBUTES": 0x000a,
  REALM: 0x0014,
  NONCE: 0x0015,
  "XOR-MAPPED-ADDRESS": 0x0020,
} as const;
type CompReqAttrType = ValueOf<typeof compReqAttrTypeRecord>;

export const compOptAttrTypeRecord = {
  SOFTWARE: 0x8022,
  "ALTERNATE-SERVER": 0x8023,
  FINGERPRINT: 0x8028,
} as const;
type CompOptAttrType = ValueOf<typeof compOptAttrTypeRecord>;

type AttrType = CompReqAttrType | CompOptAttrType;

function isAttrType(x: number): x is AttrType {
  return (
    isValueOf(x, compReqAttrTypeRecord) || isValueOf(x, compOptAttrTypeRecord)
  );
}

function fAttrType(
  strings: TemplateStringsArray,
  v: CompReqAttrType | CompOptAttrType,
): string {
  {
    const [kv] = Object.entries(compReqAttrTypeRecord).filter(
      ([, value]) => value === v,
    );
    if (kv) {
      return kv[0];
    }
  }
  {
    const [kv] = Object.entries(compOptAttrTypeRecord).filter(
      ([, value]) => value === v,
    );
    if (kv) {
      return kv[0];
    }
    throw new Error(`invalid value: '${v}' is not a value of Attribute Type.`);
  }
}

export const addrFamilyRecord = {
  ipV4: 0x01,
  ipV6: 0x02,
} as const;
type AddrFamily = ValueOf<typeof addrFamilyRecord>;

export type MappedAddressAttr = {
  type: (typeof compReqAttrTypeRecord)["MAPPED-ADDRESS"];
  length: number;
  value: {
    family: AddrFamily;
    port: number;
    addr: Buffer;
  };
};

export type UsernameAttr = {
  type: (typeof compReqAttrTypeRecord)["USERNAME"];
  length: number;
  value: {
    username: string;
  };
};

export type MessageIntegrityAttr = {
  type: (typeof compReqAttrTypeRecord)["MESSAGE-INTEGRITY"];
  length: number;
  value: Buffer;
};

export type ErrorCodeAttr = {
  type: (typeof compReqAttrTypeRecord)["ERROR-CODE"];
  length: number;
  value: {
    code: number;
    reason: string;
  };
};

type UnknownAttributesAttr = {
  type: (typeof compReqAttrTypeRecord)["UNKNOWN-ATTRIBUTES"];
  length: number;
  value: unknown;
};

export type RealmAttr = {
  type: (typeof compReqAttrTypeRecord)["REALM"];
  length: number;
  value: {
    realm: string;
  };
};

export type NonceAttr = {
  type: (typeof compReqAttrTypeRecord)["NONCE"];
  length: number;
  value: {
    nonce: string;
  };
};

export type XorMappedAddressAttr = {
  type: (typeof compReqAttrTypeRecord)["XOR-MAPPED-ADDRESS"];
  length: number;
  value:
    | {
        family: (typeof addrFamilyRecord)["ipV4"];
        port: number;
        addr: Buffer; // 32 bits
      }
    | {
        family: (typeof addrFamilyRecord)["ipV6"];
        port: number;
        addr: Buffer; // 128 bits
      };
};

type SoftwareAttr = {
  type: (typeof compOptAttrTypeRecord)["SOFTWARE"];
  length: number;
  value: unknown;
};

type AlternateServerAttr = {
  type: (typeof compOptAttrTypeRecord)["ALTERNATE-SERVER"];
  length: number;
  value: unknown;
};

type FingerprintAttr = {
  type: (typeof compOptAttrTypeRecord)["FINGERPRINT"];
  length: number;
  value: unknown;
};

export type Attr =
  | MappedAddressAttr
  | UsernameAttr
  | MessageIntegrityAttr
  | ErrorCodeAttr
  // | UnknownAttributesAttr
  | RealmAttr
  | NonceAttr
  | XorMappedAddressAttr;
// | SoftwareAttr
// | AlternateServerAttr
// | FingerprintAttr;

export type AttrWithoutLength =
  | Omit<MappedAddressAttr, "length">
  | Omit<XorMappedAddressAttr, "length">
  | Omit<ErrorCodeAttr, "length">
  | Omit<UsernameAttr, "length">
  | Omit<RealmAttr, "length">
  | Omit<NonceAttr, "length">
  | Omit<MessageIntegrityAttr, "length">;

export function encodeAttr(attr: AttrWithoutLength, trxId: Buffer): Buffer {
  const tlBuf = Buffer.alloc(4);
  tlBuf.writeUInt16BE(attr.type);

  let vBuf: Buffer;
  switch (attr.type) {
    case compReqAttrTypeRecord["MAPPED-ADDRESS"]:
      vBuf = encodeMappedAddressValue(attr.value);
      break;
    case compReqAttrTypeRecord["XOR-MAPPED-ADDRESS"]:
      vBuf = encodeXorMappedAddressValue(attr.value, trxId);
      break;
    case compReqAttrTypeRecord["ERROR-CODE"]:
      vBuf = encodeErrorCodeValue(attr.value);
      break;
    case compReqAttrTypeRecord.USERNAME:
      vBuf = encodeUsernameValue(attr.value);
      break;
    case compReqAttrTypeRecord.REALM:
      vBuf = encodeRealmValue(attr.value);
      break;
    case compReqAttrTypeRecord.NONCE:
      vBuf = encodeNonceValue(attr.value);
      break;
    default: {
      throw new Error(`invalid attr: ${attr} is not supported.`);
    }
  }

  tlBuf.writeUInt16BE(vBuf.length, 2);
  const resBuf = Buffer.concat([tlBuf, vBuf]);
  return resBuf;
}

export function decodeAttrs(buf: Buffer, header: Header): Attr[] {
  const attrs: Attr[] = [];
  let offset = 0;
  while (offset + 4 < buf.length) {
    const attrType = buf.subarray(offset, offset + 2).readUInt16BE();
    if (!isAttrType(attrType)) {
      // TODO: Distinguish between comprehension-required attributes
      // and comprehension-optional attributes.
      throw new Error(`invalid attr type; ${attrType} is not a attr type.`);
    }
    const length = buf.subarray(offset + 2, offset + 4).readUInt16BE();
    const restLength = buf.length - (offset + 4);
    if (!(restLength >= length)) {
      throw new Error(
        `invalid attr length; given ${fAttrType`${attrType}`} value length is ${length}, but the actual value length is ${restLength}.`,
      );
    }
    const vBuf = Buffer.alloc(
      length,
      buf.subarray(offset + 4, offset + 4 + length),
    );
    switch (attrType) {
      case compReqAttrTypeRecord["MAPPED-ADDRESS"]: {
        const value = decodeMappedAddressValue(vBuf);
        attrs.push({ type: attrType, length, value });
        break;
      }
      case compReqAttrTypeRecord["XOR-MAPPED-ADDRESS"]: {
        const value = decodeXorMappedAddressValue(vBuf, header);
        attrs.push({ type: attrType, length, value });
        break;
      }
      case compReqAttrTypeRecord["ERROR-CODE"]: {
        const value = decodeErrorCodeValue(vBuf);
        attrs.push({ type: attrType, length, value });
        break;
      }
      case compReqAttrTypeRecord.USERNAME: {
        const value = decodeUsernameValue(vBuf);
        attrs.push({ type: attrType, length, value });
        break;
      }
      case compReqAttrTypeRecord.REALM: {
        const value = decodeRealmValue(vBuf);
        attrs.push({ type: attrType, length, value });
        break;
      }
      case compReqAttrTypeRecord.NONCE: {
        const value = decodeNonceValue(vBuf);
        attrs.push({ type: attrType, length, value });
        break;
      }
      default:
        throw new Error(
          `invalid attr type; ${fAttrType`${attrType}`} is not supported.`,
        );
    }
    offset += 4 + length;
  }
  return attrs;
}

export function encodeMappedAddressValue(
  value: MappedAddressAttr["value"],
): Buffer {
  const { family, port, addr } = value;
  const buf = Buffer.alloc(family === addrFamilyRecord.ipV4 ? 8 : 20);
  buf.writeUint8(0);
  buf.writeUint8(family, 1);
  buf.writeUInt16BE(port, 2);
  buf.fill(addr, 4);
  return buf;
}

export function decodeMappedAddressValue(
  buf: Buffer,
): MappedAddressAttr["value"] {
  const family = buf[1]!;
  assertValueOf(
    family,
    addrFamilyRecord,
    new Error(`invalid address family: '${family}' is not a address family.`),
  );
  const port = buf.subarray(2, 4).readUInt16BE();
  let addr: Buffer;
  switch (family) {
    case addrFamilyRecord.ipV4:
      addr = Buffer.alloc(4, buf.subarray(4, 8));
      break;
    case addrFamilyRecord.ipV6:
      addr = Buffer.alloc(16, buf.subarray(4, 20));
      break;
  }
  return { family, addr, port };
}

export function encodeXorMappedAddressValue(
  value: XorMappedAddressAttr["value"],
  trxId: Buffer,
): Buffer {
  const { family, port, addr } = value;
  const xPort = port ^ (magicCookie >>> 16);
  const buf = Buffer.alloc(family === addrFamilyRecord.ipV4 ? 8 : 20);
  buf.writeUint8(0);
  buf.writeUint8(family, 1);
  buf.writeUInt16BE(xPort, 2);
  switch (family) {
    case addrFamilyRecord.ipV4:
      {
        const xAddr = addr.readInt32BE() ^ magicCookie;
        buf.writeInt32BE(xAddr, 4);
      }
      return buf;
    case addrFamilyRecord.ipV6:
      {
        const rand = Buffer.concat([numToBuf(magicCookie, 4), trxId]);
        const xAddr = xorBufs(addr, rand);
        buf.fill(xAddr, 4);
      }
      return buf;
  }
}

export function decodeXorMappedAddressValue(
  buf: Buffer,
  header: Header,
): XorMappedAddressAttr["value"] {
  const family = buf[1]!;
  assertValueOf(
    family,
    addrFamilyRecord,
    new Error(`invalid address family: '${family}' is not a address family.`),
  );
  const port = buf.subarray(2, 4).readUInt16BE() ^ (magicCookie >>> 16);
  switch (family) {
    case addrFamilyRecord.ipV4: {
      const xres = buf.subarray(4, 8).readInt32BE() ^ magicCookie;
      const addr = Buffer.alloc(4);
      addr.writeInt32BE(xres);
      return { port, family, addr };
    }
    case addrFamilyRecord.ipV6: {
      const rand = Buffer.concat([numToBuf(magicCookie, 4), header.trxId]);
      const xored = xorBufs(buf.subarray(4, 20), rand);
      const addr = Buffer.alloc(16, xored);
      return { port, family, addr };
    }
  }
}

export function encodeErrorCodeValue(value: ErrorCodeAttr["value"]): Buffer {
  const { code, reason } = value;
  if (!(300 <= code && code <= 699)) {
    throw new Error(
      `invalid error code; error code must be [300, 699]. '${code}' given.`,
    );
  }
  const reasonBuf = Buffer.from(reason, "utf-8");
  // ignoreing the num of chars in utf-8 specified by https://datatracker.ietf.org/doc/html/rfc5389#autoid-44
  if (!(reasonBuf.length <= 763)) {
    throw new Error(
      "invalid reason phrase; reason phrase must be <= 763 bytes.",
    );
  }
  const buf = Buffer.alloc(4);
  buf.writeUInt8(Math.floor(code / 100), 2);
  buf.writeUInt8(code % 100, 3);
  const resBuf = Buffer.concat([buf, reasonBuf]);
  return resBuf;
}

export function decodeErrorCodeValue(buf: Buffer): ErrorCodeAttr["value"] {
  const cls = buf.subarray(2, 3).readUInt8();
  if (!(3 <= cls && cls <= 6)) {
    throw new Error(
      `invalid error class; expected error class is in [3, 6]. actual is \`${cls}\`.`,
    );
  }
  const num = buf.subarray(3, 4).readUInt8();
  if (!(0 <= num && num <= 99)) {
    throw new Error(
      `invalid error number; expected error number is in [0, 99]. actual is \`${num}\`.`,
    );
  }
  const reasonBuf = buf.subarray(4);
  if (!(reasonBuf.length <= 763)) {
    throw new Error(
      "invalid reason phrase; expected reason phrase is <= 763 bytes. actual is > 763 bytes.",
    );
  }
  const reason = reasonBuf.toString("utf-8");
  return { code: cls * 100 + num, reason };
}

export function encodeUsernameValue(value: UsernameAttr["value"]): Buffer {
  const buf = Buffer.from(value.username, "utf8");
  if (!(buf.length < 513)) {
    throw new Error(
      `invalid username; expected is < 513 bytes. actual is ${buf.length}.`,
    );
  }
  return buf;
}

export function decodeUsernameValue(buf: Buffer): UsernameAttr["value"] {
  const res = buf.toString("utf8");
  return { username: res };
}

export function encodeRealmValue(value: RealmAttr["value"]): Buffer {
  const buf = Buffer.from(value.realm, "utf8");
  if (!(buf.length <= 763)) {
    throw new Error(
      `invalid realm; expected is < 763 bytes. actual is ${buf.length}.`,
    );
  }
  return buf;
}

export function decodeRealmValue(buf: Buffer): RealmAttr["value"] {
  const res = buf.toString("utf8");
  return { realm: res };
}

export function encodeNonceValue(value: NonceAttr["value"]): Buffer {
  const buf = Buffer.from(value.nonce, "utf8");
  if (!(buf.length <= 763)) {
    throw new Error(
      `invalid nonce; expected is < 763 bytes. actual is ${buf.length}.`,
    );
  }
  return buf;
}

export function decodeNonceValue(buf: Buffer): NonceAttr["value"] {
  const res = buf.toString("utf8");
  return { nonce: res };
}

function calcMessageIntegrity(
  args:
    | {
        term: "long";
        username: string;
        realm: string;
        password: string;
        msg: Buffer;
      }
    | {
        term: "short";
        password: string;
        msg: Buffer;
      },
): Buffer {
  let key: Buffer;
  const md5 = createHash("md5");
  switch (args.term) {
    case "long": {
      const { username, realm, password } = args;
      key = md5.update(`${username}:${realm}:${password}`).digest();
      break;
    }
    case "short": {
      const { password } = args;
      key = md5.update(password).digest();
      break;
    }
  }
  const hmac = createHmac("sha1", key);
  hmac.update(args.msg);
  return hmac.digest();
}

const MESSAGE_INTEGRITY_BYTES = 20;
const DUMMY_CONTENT = Buffer.alloc(MESSAGE_INTEGRITY_BYTES);

export function encodeMessageIntegrityValue(
  args:
    | {
        term: "long";
        username: string;
        realm: string;
        password: string;
        msg: StunMsg;
      }
    | {
        term: "short";
        password: string;
        msg: StunMsg;
      },
): Buffer {
  const { msg } = args;
  const tmpMsg: EncodeStunMsgParams = {
    ...msg,
    attrs: [
      ...msg.attrs,
      {
        type: compReqAttrTypeRecord["MESSAGE-INTEGRITY"],
        value: DUMMY_CONTENT,
      },
    ],
  };
  const encodedMsg = encodeStunMsg(tmpMsg);
  const integrity = calcMessageIntegrity({
    ...args,
    msg: encodedMsg,
  });
  return integrity;
}
