import { createHash, createHmac } from "node:crypto";
import { crc32 } from "node:zlib";
import {
  assert,
  assertValueOf,
  fAddr,
  getKey,
  numToBuf,
  pAddr,
  xorBufs,
} from "@e5pe0n/lib";
import { magicCookie } from "./consts.js";
import { type Header, readTrxId } from "./header.js";
import type { RawStunMsg } from "./types.js";

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
  // "ALTERNATE-SERVER": 0x8023,
  FINGERPRINT: 0x8028,
} as const;
export type AttrType = keyof typeof attrTypeRecord;

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
export type OutputMappedAddressAttr = InputMappedAddressAttr;

export type InputUsernameAttr = {
  type: "USERNAME";
  value: string;
};
export type OutputUsernameAttr = InputUsernameAttr;

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
  value: Buffer;
};

export type InputErrorCodeAttr = {
  type: "ERROR-CODE";
  value: {
    code: number;
    reason: string;
  };
};
export type OutputErrorCodeAttr = InputErrorCodeAttr;

export type InputUnknownAttributesAttr = {
  type: "UNKNOWN-ATTRIBUTES";
  value: number[];
};
export type OutputUnknownAttributesAttr = InputUnknownAttributesAttr;

export type InputRealmAttr = {
  type: "REALM";
  value: string;
};
export type OutputRealmAttr = InputRealmAttr;

export type InputNonceAttr = {
  type: "NONCE";
  value: string;
};
export type OutputNonceAttr = InputNonceAttr;

export type InputXorMappedAddressAttr = {
  type: "XOR-MAPPED-ADDRESS";
  value: {
    family: AddrFamily;
    port: number;
    address: string;
  };
};
export type OutputXorMappedAddressAttr = InputXorMappedAddressAttr;

type SoftwareAttr = {
  type: "SOFTWARE";
  value: string;
};

type AlternateServerAttr = {
  type: "ALTERNATE-SERVER";
  value: unknown;
};

type InputFingerprintAttr = {
  type: "FINGERPRINT";
};
type OutputFingerprintAttr = InputFingerprintAttr & {
  value: number;
};

export type OutputAttr =
  | OutputMappedAddressAttr
  | OutputUsernameAttr
  | OutputMessageIntegrityAttr
  | OutputErrorCodeAttr
  | OutputUnknownAttributesAttr
  | OutputRealmAttr
  | OutputNonceAttr
  | OutputXorMappedAddressAttr
  | SoftwareAttr
  // | AlternateServerAttr
  | OutputFingerprintAttr;

export type InputAttr =
  | InputMappedAddressAttr
  | InputUsernameAttr
  | InputMessageIntegrityAttr
  | InputErrorCodeAttr
  | InputUnknownAttributesAttr
  | InputRealmAttr
  | InputNonceAttr
  | InputXorMappedAddressAttr
  | InputMessageIntegrityAttr
  | InputFingerprintAttr
  | SoftwareAttr;

export type AttrvEncoders<IA extends { type: string }> = {
  [AT in IA["type"]]: (
    attr: Extract<IA, { type: AT }>,
    msg: RawStunMsg,
  ) => Buffer;
};

export const attrValueEncoders: AttrvEncoders<InputAttr> = {
  "MAPPED-ADDRESS": (attr) => encodeMappedAddressValue(attr.value),
  USERNAME: (attr) => encodeUsernameValue(attr.value),
  "ERROR-CODE": (attr) => encodeErrorCodeValue(attr.value),
  FINGERPRINT: (_, msg) => encodeFingerprintValue(msg),
  "MESSAGE-INTEGRITY": (attr, msg) =>
    encodeMessageIntegrityValue(attr.params, msg),
  REALM: (attr) => encodeRealmValue(attr.value),
  NONCE: (attr) => encodeNonceValue(attr.value),
  "XOR-MAPPED-ADDRESS": (attr, msg) =>
    encodeXorMappedAddressValue(attr.value, msg),
  "UNKNOWN-ATTRIBUTES": (attr) => encodeUnknownAttributesValue(attr.value),
  SOFTWARE: (attr) => encodeSoftwareValue(attr.value),
};

export function buildAttrEncoder<IA extends { type: string }>(
  attrTypes: Record<IA["type"], number>,
  attrValueEncoders: AttrvEncoders<IA>,
): (attr: IA, msg: RawStunMsg) => Buffer {
  return (attr: IA, msg: RawStunMsg) => {
    const tlBuf = Buffer.alloc(4);
    tlBuf.writeUInt16BE(attrTypes[attr.type as IA["type"]]);
    const vBuf = attrValueEncoders[attr.type as IA["type"]](
      attr as Extract<IA, { type: IA["type"] }>,
      msg,
    );
    tlBuf.writeUInt16BE(vBuf.length, 2);
    const resBuf = Buffer.concat([tlBuf, vBuf]);
    return resBuf;
  };
}

export type AttrvDecoders<OA extends { type: string; value: unknown }> = {
  [AT in OA["type"]]: (
    attrv: Buffer,
    header: Header,
  ) => Extract<OA, { type: AT }>["value"];
};

export const attrValueDecoders: AttrvDecoders<OutputAttr> = {
  "ERROR-CODE": (buf) => decodeErrorCodeValue(buf),
  FINGERPRINT: (buf) => buf.readInt32BE(),
  "MAPPED-ADDRESS": (buf) => decodeMappedAddressValue(buf),
  NONCE: (buf) => decodeStrValue(buf),
  REALM: (buf) => decodeStrValue(buf),
  USERNAME: (buf) => decodeStrValue(buf),
  "MESSAGE-INTEGRITY": (buf) => buf,
  "XOR-MAPPED-ADDRESS": (buf, header) =>
    decodeXorMappedAddressValue(buf, header),
  "UNKNOWN-ATTRIBUTES": (buf) => decodeUnknownAttributeValue(buf),
  SOFTWARE: (buf) => decodeStrValue(buf),
};

export function buildAttrsDecoder<OA extends { type: string; value: unknown }>(
  attrTypes: Record<OA["type"], number>,
  attrvDecoders: AttrvDecoders<OA>,
): (buf: Buffer, header: Header) => OA[] {
  return (buf, header) => {
    const attrs: OA[] = [];
    let offset = 0;
    while (offset + 4 < buf.length) {
      const attrType = buf.subarray(offset, offset + 2).readUInt16BE();
      // TODO: Distinguish between comprehension-required attributes
      // and comprehension-optional attributes.
      assertValueOf(
        attrType,
        attrTypes,
        new Error(`invalid attr type; ${attrType} is not a attr type.`),
      );
      const kAttrType = getKey(attrTypes, attrType);
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
      const attrv = attrvDecoders[kAttrType as OA["type"]](vBuf, header);
      attrs.push({ type: kAttrType, value: attrv } as unknown as OA);
      offset += 4 + length;
    }
    return attrs;
  };
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
  msg: RawStunMsg,
): Buffer {
  const trxId = readTrxId(msg);
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

export function encodeSoftwareValue(value: SoftwareAttr["value"]): Buffer {
  const buf = Buffer.from(value, "utf8");
  assert(
    buf.length <= 763,
    new Error(
      `invalid realm; expected is < 763 bytes. actual is ${buf.length}.`,
    ),
  );
  return buf;
}

export function decodeSoftwareValue(buf: Buffer): SoftwareAttr["value"] {
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

export function encodeUnknownAttributesValue(
  value: InputUnknownAttributesAttr["value"],
): Buffer {
  const requiredBytes = 2 * value.length;
  const alignedBytes = requiredBytes + (4 - (requiredBytes % 4));
  const buf = Buffer.alloc(alignedBytes);
  for (const [i, v] of value.entries()) {
    buf.writeUInt16BE(v, i * 2);
  }
  return buf;
}

export function decodeUnknownAttributeValue(
  buf: Buffer,
): OutputUnknownAttributesAttr["value"] {
  const res: OutputUnknownAttributesAttr["value"] = [];
  for (let i = 0; i < buf.length; i += 2) {
    const n = buf.readInt16BE(i);
    if (n === 0) {
      // padding
      break;
    }
    res.push(n);
  }
  return res;
}
