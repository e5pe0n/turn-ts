import { type AttrType, attrTypeRecord } from "./attr.js";
import {
  HEADER_LENGTH,
  type MsgClass,
  type MsgMethod,
  encodeHeader,
} from "./header.js";
import type { RawStunMsg } from "./types.js";

export class RawStunMsgBuilder {
  #raw: RawStunMsg;

  private constructor(raw: RawStunMsg) {
    this.#raw = raw;
  }

  static from(raw: RawStunMsg): RawStunMsgBuilder {
    return new RawStunMsgBuilder(Buffer.from(raw) as RawStunMsg);
  }

  static init(header: {
    cls: MsgClass;
    method: MsgMethod;
    trxId: Buffer;
  }): RawStunMsgBuilder {
    const raw = encodeHeader({ ...header, length: 0 });
    return new RawStunMsgBuilder(raw as RawStunMsg);
  }

  addAttr(type: AttrType, value: Buffer): void {
    const tlBuf = Buffer.alloc(4);
    tlBuf.writeUInt16BE(attrTypeRecord[type]);
    tlBuf.writeUInt16BE(value.length, 2);
    this.#raw = Buffer.concat([this.#raw, tlBuf, value]) as RawStunMsg;
    this.#writeMsgLength();
  }

  #writeMsgLength(): void {
    this.#raw.subarray(2, 4).writeUInt16BE(this.#raw.length - HEADER_LENGTH);
  }

  get msgLength(): number {
    return this.#raw.subarray(2, 4).readUInt16BE();
  }

  get raw(): RawStunMsg {
    return Buffer.from(this.#raw) as RawStunMsg;
  }

  clone(): RawStunMsgBuilder {
    return new RawStunMsgBuilder(this.raw);
  }
}
