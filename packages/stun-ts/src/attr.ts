import {
  assert,
  assertValueOf,
  fAddr,
  getKey,
  numToBuf,
  pAddr,
  xorBufs,
} from "@e5pe0n/lib";
import { magicCookie } from "./common.js";

const compReqRange = [0x0000, 0x7fff] as const;

export function isCompReqAttr(attrType: number): boolean {
  return compReqRange[0] <= attrType && attrType <= compReqRange[1];
}

// https://datatracker.ietf.org/doc/html/rfc5389#autoid-63
export const attrTypeRecord = {
  mappedAddress: 0x0001,
  username: 0x0006,
  messageIntegrity: 0x0008,
  errorCode: 0x0009,
  unknownAttributes: 0x000a,
  realm: 0x0014,
  nonce: 0x0015,
  xorMappedAddress: 0x0020,
  // TODO: Separate into optional attribute records
  software: 0x8022,
  // "ALTERNATE-SERVER": 0x8023,
  fingerprint: 0x8028,
} as const;
export type AttrType = keyof typeof attrTypeRecord;

export const addrFamilyRecord = {
  IPv4: 0x01,
  IPv6: 0x02,
} as const;
export type AddrFamily = keyof typeof addrFamilyRecord;

type MappedAddressAttr = {
  family: AddrFamily;
  port: number;
  address: string;
};

export function encodeMappedAddressValue({
  family,
  port,
  address,
}: MappedAddressAttr): Buffer {
  const buf = Buffer.alloc(family === "IPv4" ? 8 : 20);
  buf.writeUint8(0);
  buf.writeUint8(addrFamilyRecord[family], 1);
  buf.writeUInt16BE(port, 2);
  buf.fill(pAddr(address), 4);
  return buf;
}
export function decodeMappedAddressValue(buf: Buffer): {
  family: AddrFamily;
  port: number;
  address: string;
} {
  const family = buf[1]!;
  assertValueOf(
    family,
    addrFamilyRecord,
    new Error(
      `invalid address family: '0x${family.toString(16)}' is not a valid address family.`,
    ),
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

export function encodeXorAddressValue({
  family,
  port,
  address,
  trxId,
}: MappedAddressAttr & {
  trxId: Buffer;
}): Buffer {
  const xPort = port ^ (magicCookie >>> 16);
  const buf = Buffer.alloc(family === "IPv4" ? 8 : 20);
  buf.writeUint8(0);
  buf.writeUint8(addrFamilyRecord[family], 1);
  buf.writeUInt16BE(xPort, 2);
  const addrBuf = pAddr(address);
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
export function decodeXorAddressValue(
  buf: Buffer,
  trxId: Buffer,
): {
  family: AddrFamily;
  port: number;
  address: string;
} {
  const family = buf[1]!;
  assertValueOf(
    family,
    addrFamilyRecord,
    new Error(
      `invalid address family: '0x${family.toString(16)}' is not a valid address family.`,
    ),
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
      const rand = Buffer.concat([numToBuf(magicCookie, 4), trxId]);
      const xored = xorBufs(buf.subarray(4, 20), rand);
      const addr = Buffer.alloc(16, xored);
      return { port, family: kFamily, address: fAddr(addr) };
    }
  }
}

export function encodeErrorCodeValue({
  code,
  reason,
}: {
  code: number;
  reason: string;
}): Buffer {
  if (!(300 <= code && code <= 699)) {
    throw new Error(
      `invalid error code; error code must be [300, 699]. '${code}' given.`,
    );
  }
  const reasonBuf = Buffer.from(reason, "utf-8");
  // ignoring the num of chars in utf-8 specified by https://datatracker.ietf.org/doc/html/rfc5389#autoid-44
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
export function decodeErrorCodeValue(buf: Buffer): {
  code: number;
  reason: string;
} {
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
      `invalid reason phrase; expected reason phrase is <= 763 bytes. actual is ${reasonBuf.length} bytes.`,
    );
  }
  const reason = reasonBuf.toString("utf-8");
  return { code: cls * 100 + num, reason };
}

export function encodeUsernameValue(username: string): Buffer {
  const buf = Buffer.from(username, "utf8");
  if (!(buf.length < 513)) {
    throw new Error(
      `invalid username; expected is < 513 bytes. actual is ${buf.length} bytes.`,
    );
  }
  return buf;
}

export function decodeStrValue(buf: Buffer): string {
  return buf.toString("utf8");
}

export function encodeRealmValue(realm: string): Buffer {
  const buf = Buffer.from(realm, "utf8");
  if (!(buf.length <= 763)) {
    throw new Error(
      `invalid realm; expected is < 763 bytes. actual is ${buf.length} bytes.`,
    );
  }
  return buf;
}

export function encodeNonceValue(nonce: string): Buffer {
  const buf = Buffer.from(nonce, "utf8");
  if (!(buf.length <= 763)) {
    throw new Error(
      `invalid nonce; expected is < 763 bytes. actual is ${buf.length} bytes.`,
    );
  }
  return buf;
}

export function encodeSoftwareValue(software: string): Buffer {
  const buf = Buffer.from(software, "utf8");
  assert(
    buf.length <= 763,
    new Error(
      `invalid software; expected is < 763 bytes. actual is ${buf.length} bytes.`,
    ),
  );
  return buf;
}

export function encodeUnknownAttributesValue(attrTypes: number[]): Buffer {
  const requiredBytes = 2 * attrTypes.length;
  const alignedBytes = requiredBytes + (4 - (requiredBytes % 4));
  const buf = Buffer.alloc(alignedBytes);
  for (const [i, v] of attrTypes.entries()) {
    buf.writeUInt16BE(v, i * 2);
  }
  return buf;
}
export function decodeUnknownAttributesValue(buf: Buffer): number[] {
  const res: number[] = [];
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
