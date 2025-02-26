import { crc32 } from "node:zlib";
import type { RawStunMsg } from "./types.js";

// https://datatracker.ietf.org/doc/html/rfc5389#section-15.5
const FINGERPRINT_XORER = 0x5354554e;

export function encodeFingerprintValue(raw: RawStunMsg): Buffer {
  const buf = Buffer.alloc(4);
  const fingerprint = crc32(raw) ^ FINGERPRINT_XORER;
  buf.writeInt32BE(fingerprint);
  return buf;
}
