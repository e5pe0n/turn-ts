import { createHash, createHmac } from "node:crypto";
import { magicCookie } from "./consts.js";
import { type Header, readTrxId } from "./header.js";
import {
  assertValueOf,
  fAddr,
  getKey,
  numToBuf,
  pAddr,
  xorBufs,
} from "./helpers.js";
import type { RawStunMsg } from "./types.js";
import { crc32 } from "node:zlib";

const compReqRange = [0x0000, 0x7fff] as const;
const compOptRange = [0x8000, 0xffff] as const;

export const attrTypeRecord = {
  "MAPPED-ADDRESS": 0x0001,
  USERNAME: 0x0006,
  "MESSAGE-INTEGRITY": 0x0008,
  "ERROR-CODE": 0x0009,
  "UNKNOWN-ATTRIBUTES": 0x000a,
  REALM: 0x0014,
  NONCE: 0x0015,
  "XOR-MAPPED-ADDRESS": 0x0020,
  // TODO: Separate into optional attribute records
  SOFTWARE: 0x8022,
  "ALTERNATE-SERVER": 0x8023,
  FINGERPRINT: 0x8028,
} as const;
type AttrType = keyof typeof attrTypeRecord;

export const addrFamilyRecord = {
  IPv4: 0x01,
  IPv6: 0x02,
} as const;
type AddrFamily = keyof typeof addrFamilyRecord;

export type InputMappedAddressAttr = {
  type: "MAPPED-ADDRESS";
  value: {
    family: AddrFamily;
    port: number;
    address: string;
  };
};
export type OutputMappedAddressAttr = InputMappedAddressAttr & {
  length: number;
};

export type InputUsernameAttr = {
  type: "USERNAME";
  value: string;
};
export type OutputUsernameAttr = InputUsernameAttr & {
  length: number;
};

type Credentials =
  | {
      term: "long";
      username: string;
      realm: string;
      password: string;
    }
  | {
      term: "short";
      password: string;
    };

export type InputMessageIntegrityAttr = {
  type: "MESSAGE-INTEGRITY";
  params: Credentials;
};
export type OutputMessageIntegrityAttr = {
  type: "MESSAGE-INTEGRITY";
  length: number;
  value: Buffer;
};

export type InputErrorCodeAttr = {
  type: "ERROR-CODE";
  value: {
    code: number;
    reason: string;
  };
};
export type OutputErrorCodeAttr = InputErrorCodeAttr & {
  length: number;
};

type UnknownAttributesAttr = {
  type: "UNKNOWN-ATTRIBUTES";
  length: number;
  value: unknown;
};

export type InputRealmAttr = {
  type: "REALM";
  value: string;
};
export type OutputRealmAttr = InputRealmAttr & {
  length: number;
};

export type InputNonceAttr = {
  type: "NONCE";
  value: string;
};
export type OutputNonceAttr = InputNonceAttr & {
  length: number;
};

export type InputXorMappedAddressAttr = {
  type: "XOR-MAPPED-ADDRESS";
  value: {
    family: AddrFamily;
    port: number;
    address: string;
  };
};
export type OutputXorMappedAddressAttr = InputXorMappedAddressAttr & {
  length: number;
};

type SoftwareAttr = {
  type: "SOFTWARE";
  length: number;
  value: unknown;
};

type AlternateServerAttr = {
  type: "ALTERNATE-SERVER";
  length: number;
  value: unknown;
};

type InputFingerprintAttr = {
  type: "FINGERPRINT";
};
type OutputFingerprintAttr = InputFingerprintAttr & {
  length: number;
  value: number;
};

export type OutputAttr =
  | OutputMappedAddressAttr
  | OutputUsernameAttr
  | OutputMessageIntegrityAttr
  | OutputErrorCodeAttr
  // | UnknownAttributesAttr
  | OutputRealmAttr
  | OutputNonceAttr
  | OutputXorMappedAddressAttr
  // | SoftwareAttr
  // | AlternateServerAttr
  | OutputFingerprintAttr;

export type InputAttr =
  | InputMappedAddressAttr
  | InputXorMappedAddressAttr
  | InputErrorCodeAttr
  | InputUsernameAttr
  | InputRealmAttr
  | InputNonceAttr
  | InputMessageIntegrityAttr
  | InputFingerprintAttr;

export function encodeAttr(attr: InputAttr, msg: RawStunMsg): Buffer {
  const tlBuf = Buffer.alloc(4);
  tlBuf.writeUInt16BE(attrTypeRecord[attr.type]);

  let vBuf: Buffer;
  switch (attr.type) {
    case "MAPPED-ADDRESS":
      vBuf = encodeMappedAddressValue(attr.value);
      break;
    case "XOR-MAPPED-ADDRESS":
      vBuf = encodeXorMappedAddressValue(attr.value, readTrxId(msg));
      break;
    case "ERROR-CODE":
      vBuf = encodeErrorCodeValue(attr.value);
      break;
    case "USERNAME":
      vBuf = encodeUsernameValue(attr.value);
      break;
    case "REALM":
      vBuf = encodeRealmValue(attr.value);
      break;
    case "NONCE":
      vBuf = encodeNonceValue(attr.value);
      break;
    case "MESSAGE-INTEGRITY":
      vBuf = encodeMessageIntegrityValue(attr.params, msg);
      break;
    case "FINGERPRINT":
      vBuf = encodeFingerprintValue(msg);
      break;
    default: {
      throw new Error(`invalid attr: ${attr} is not supported.`);
    }
  }

  tlBuf.writeUInt16BE(vBuf.length, 2);
  const resBuf = Buffer.concat([tlBuf, vBuf]);
  return resBuf;
}

export function decodeAttrs(buf: Buffer, header: Header): OutputAttr[] {
  const attrs: OutputAttr[] = [];
  let offset = 0;
  while (offset + 4 < buf.length) {
    const attrType = buf.subarray(offset, offset + 2).readUInt16BE();
    // TODO: Distinguish between comprehension-required attributes
    // and comprehension-optional attributes.
    assertValueOf(
      attrType,
      attrTypeRecord,
      new Error(`invalid attr type; ${attrType} is not a attr type.`),
    );
    const kAttrType = getKey(attrTypeRecord, attrType);
    const length = buf.subarray(offset + 2, offset + 4).readUInt16BE();
    const restLength = buf.length - (offset + 4);
    if (!(restLength >= length)) {
      throw new Error(
        `invalid attr length; given ${kAttrType} value length is ${length}, but the actual value length is ${restLength}.`,
      );
    }
    const vBuf = Buffer.alloc(
      length,
      buf.subarray(offset + 4, offset + 4 + length),
    );
    switch (kAttrType) {
      case "MAPPED-ADDRESS": {
        const value = decodeMappedAddressValue(vBuf);
        attrs.push({ type: kAttrType, length, value });
        break;
      }
      case "XOR-MAPPED-ADDRESS": {
        const value = decodeXorMappedAddressValue(vBuf, header);
        attrs.push({ type: kAttrType, length, value });
        break;
      }
      case "ERROR-CODE": {
        const value = decodeErrorCodeValue(vBuf);
        attrs.push({ type: kAttrType, length, value });
        break;
      }
      case "USERNAME": {
        const value = decodeUsernameValue(vBuf);
        attrs.push({ type: kAttrType, length, value });
        break;
      }
      case "REALM": {
        const value = decodeRealmValue(vBuf);
        attrs.push({ type: kAttrType, length, value });
        break;
      }
      case "NONCE": {
        const value = decodeNonceValue(vBuf);
        attrs.push({ type: kAttrType, length, value });
        break;
      }
      case "MESSAGE-INTEGRITY": {
        attrs.push({ type: kAttrType, length, value: vBuf });
        break;
      }
      case "FINGERPRINT": {
        const value = vBuf.readInt32BE();
        attrs.push({ type: kAttrType, length, value });
        break;
      }
      default:
        throw new Error(`invalid attr type; ${kAttrType} is not supported.`);
    }
    offset += 4 + length;
  }
  return attrs;
}

export function readAttrs(msg: RawStunMsg, header: Header): OutputAttr[] {
  return decodeAttrs(msg.subarray(20, 20 + header.length), header);
}

export function encodeMappedAddressValue(
  value: InputMappedAddressAttr["value"],
): Buffer {
  const { family, port, address: addr } = value;
  const buf = Buffer.alloc(family === "IPv4" ? 8 : 20);
  buf.writeUint8(0);
  buf.writeUint8(addrFamilyRecord[family], 1);
  buf.writeUInt16BE(port, 2);
  buf.fill(pAddr(addr), 4);
  return buf;
}

export function decodeMappedAddressValue(
  buf: Buffer,
): InputMappedAddressAttr["value"] {
  const family = buf[1]!;
  assertValueOf(
    family,
    addrFamilyRecord,
    new Error(`invalid address family: '${family}' is not a address family.`),
  );
  const kFamily = getKey(addrFamilyRecord, family);
  const port = buf.subarray(2, 4).readUInt16BE();
  let addr: string;
  switch (kFamily) {
    case "IPv4":
      addr = fAddr(Buffer.alloc(4, buf.subarray(4, 8)));
      break;
    case "IPv6":
      addr = fAddr(Buffer.alloc(16, buf.subarray(4, 20)));
      break;
  }
  return { family: kFamily, address: addr, port };
}

export function encodeXorMappedAddressValue(
  value: InputXorMappedAddressAttr["value"],
  trxId: Buffer,
): Buffer {
  const { family, port, address: addr } = value;
  const xPort = port ^ (magicCookie >>> 16);
  const buf = Buffer.alloc(family === "IPv4" ? 8 : 20);
  buf.writeUint8(0);
  buf.writeUint8(addrFamilyRecord[family], 1);
  buf.writeUInt16BE(xPort, 2);
  const addrBuf = pAddr(addr);
  switch (family) {
    case "IPv4":
      {
        const xAddrBuf = addrBuf.readInt32BE() ^ magicCookie;
        buf.writeInt32BE(xAddrBuf, 4);
      }
      return buf;
    case "IPv6":
      {
        const rand = Buffer.concat([numToBuf(magicCookie, 4), trxId]);
        const xAddrBuf = xorBufs(addrBuf, rand);
        buf.fill(xAddrBuf, 4);
      }
      return buf;
  }
}

export function decodeXorMappedAddressValue(
  buf: Buffer,
  header: Header,
): InputXorMappedAddressAttr["value"] {
  const family = buf[1]!;
  assertValueOf(
    family,
    addrFamilyRecord,
    new Error(`invalid address family: '${family}' is not a address family.`),
  );
  const kFamily = getKey(addrFamilyRecord, family);
  const port = buf.subarray(2, 4).readUInt16BE() ^ (magicCookie >>> 16);
  switch (kFamily) {
    case "IPv4": {
      const xres = buf.subarray(4, 8).readInt32BE() ^ magicCookie;
      const addr = Buffer.alloc(4);
      addr.writeInt32BE(xres);
      return { port, family: kFamily, address: fAddr(addr) };
    }
    case "IPv6": {
      const rand = Buffer.concat([numToBuf(magicCookie, 4), header.trxId]);
      const xored = xorBufs(buf.subarray(4, 20), rand);
      const addr = Buffer.alloc(16, xored);
      return { port, family: kFamily, address: fAddr(addr) };
    }
  }
}

export function encodeErrorCodeValue(
  value: InputErrorCodeAttr["value"],
): Buffer {
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

export function decodeErrorCodeValue(buf: Buffer): InputErrorCodeAttr["value"] {
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

export function encodeUsernameValue(value: InputUsernameAttr["value"]): Buffer {
  const buf = Buffer.from(value, "utf8");
  if (!(buf.length < 513)) {
    throw new Error(
      `invalid username; expected is < 513 bytes. actual is ${buf.length}.`,
    );
  }
  return buf;
}

export function decodeStrValue(buf: Buffer): string {
  return buf.toString("utf8");
}

export function decodeUsernameValue(buf: Buffer): OutputUsernameAttr["value"] {
  return decodeStrValue(buf);
}

export function encodeRealmValue(value: OutputRealmAttr["value"]): Buffer {
  const buf = Buffer.from(value, "utf8");
  if (!(buf.length <= 763)) {
    throw new Error(
      `invalid realm; expected is < 763 bytes. actual is ${buf.length}.`,
    );
  }
  return buf;
}

export function decodeRealmValue(buf: Buffer): OutputRealmAttr["value"] {
  return decodeStrValue(buf);
}

export function encodeNonceValue(value: OutputNonceAttr["value"]): Buffer {
  const buf = Buffer.from(value, "utf8");
  if (!(buf.length <= 763)) {
    throw new Error(
      `invalid nonce; expected is < 763 bytes. actual is ${buf.length}.`,
    );
  }
  return buf;
}

export function decodeNonceValue(buf: Buffer): OutputNonceAttr["value"] {
  return decodeStrValue(buf);
}

function calcMessageIntegrity(
  arg: Credentials & {
    msg: RawStunMsg;
  },
): Buffer {
  let key: Buffer;
  const md5 = createHash("md5");
  switch (arg.term) {
    case "long": {
      const { username, realm, password } = arg;
      key = md5.update(`${username}:${realm}:${password}`).digest();
      break;
    }
    case "short": {
      const { password } = arg;
      key = md5.update(password).digest();
      break;
    }
  }
  const hmac = createHmac("sha1", key);
  hmac.update(arg.msg);
  return hmac.digest();
}

const MESSAGE_INTEGRITY_BYTES = 20;

export function encodeMessageIntegrityValue(
  params: InputMessageIntegrityAttr["params"],
  msg: RawStunMsg,
): OutputMessageIntegrityAttr["value"] {
  const tlBuf = Buffer.alloc(4);
  tlBuf.writeUInt16BE(attrTypeRecord["MESSAGE-INTEGRITY"]);
  tlBuf.writeUInt16BE(MESSAGE_INTEGRITY_BYTES);
  const vBuf = Buffer.alloc(MESSAGE_INTEGRITY_BYTES);

  const tmpMsg = Buffer.concat([Buffer.from(msg), tlBuf, vBuf]) as RawStunMsg;
  tmpMsg.writeUInt16BE(tmpMsg.length);
  const integrity = calcMessageIntegrity({
    ...params,
    msg: tmpMsg,
  });

  return integrity;
}

// https://datatracker.ietf.org/doc/html/rfc5389#section-15.5
const FINGERPRINT_XORER = 0x5354554e;

export function encodeFingerprintValue(msg: RawStunMsg): Buffer {
  const buf = Buffer.alloc(4);
  const fingerprint = crc32(msg) ^ FINGERPRINT_XORER;
  buf.writeInt32BE(fingerprint);
  return buf;
}
