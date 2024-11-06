import { randomBytes } from "node:crypto";
import { type Socket, createSocket } from "node:dgram";
import { magicCookie } from "./consts.js";
import {
  type MsgClass,
  type MsgMethod,
  encodeHeader,
  readMagicCookie,
} from "./header.js";
import { assert, retry } from "./helpers.js";
import type { RawStunMsg } from "./types.js";
import { decodeStunMsg, type StunMsg } from "./msg.js";
import { createConnection } from "node:net";

export function assertStunMSg(msg: Buffer): asserts msg is RawStunMsg {
  assert(
    msg.length >= 20,
    new Error(
      `invalid stun msg; expected msg length is >= 20 bytes. actual length is ${msg.length}.`,
    ),
  );
  assert(
    msg.length % 4 === 0,
    new Error(
      `invalid stun msg; expected msg length is a multiple of 4 bytes. actual length is ${msg.length}.`,
    ),
  );
  const fstBits = msg[0]! >>> 6;
  assert(
    fstBits === 0,
    new Error(
      `invalid stun msg; expected the most significant 2 bits is 0b00. actual is ${fstBits.toString(2)}.`,
    ),
  );

  const stunMsg = msg as RawStunMsg;
  const cookie = readMagicCookie(stunMsg);
  assert(
    cookie === magicCookie,
    new Error(
      `invalid stun msg; invalid magic cookie. actual is ${cookie.toString(16)}.`,
    ),
  );
}

export type UdpAgentConfig = {
  address: string;
  port: number;
  rtoMs?: number;
  rc?: number;
  rm?: number;
};

export class UdpAgent {
  #address: string;
  #port: number;
  #sock: Socket;
  #rtoMs = 3000;
  #rc = 7;
  #rm = 16;

  constructor(config: UdpAgentConfig) {
    this.#address = config.address;
    this.#port = config.port;
    this.#sock = createSocket("udp4");
    this.#rtoMs = config.rtoMs ?? this.#rtoMs;
    this.#rc = config.rc ?? this.#rc;
    this.#rm = config.rm ?? this.#rm;
  }

  async send(
    cls: Extract<MsgClass, "Indication">,
    method: MsgMethod,
  ): Promise<undefined>;
  async send(
    cls: Extract<MsgClass, "Request">,
    method: MsgMethod,
  ): Promise<StunMsg>;
  async send(cls: MsgClass, method: MsgMethod): Promise<undefined | StunMsg> {
    const trxId = randomBytes(12);
    const hBuf = encodeHeader({
      cls,
      method,
      trxId,
      length: 0,
    });
    this.#sock.bind();
    try {
      switch (cls) {
        case "Indication":
          await new Promise<void>((resolve, reject) => {
            this.#sock.send(hBuf, this.#port, this.#address, (err, bytes) => {
              if (err) {
                reject(err);
              }
              resolve();
            });
          });
          return;
        case "Request": {
          const _res = new Promise<Buffer>((resolve, reject) => {
            this.#sock.on("message", (msg) => {
              resolve(msg);
            });
          });
          const _req = async (): Promise<void> =>
            new Promise((resolve, reject) => {
              this.#sock.send(hBuf, this.#port, this.#address, (err, bytes) => {
                reject(err);
              });
            });

          const resBuf = (await Promise.race([
            retry(
              _req,
              this.#rc,
              (numAttempts: number) => this.#rtoMs * numAttempts,
              this.#rtoMs * this.#rm,
            ),
            _res,
          ])) as Buffer;
          assertStunMSg(resBuf);
          const resMsg = decodeStunMsg(resBuf);
          assert(
            resMsg.header.trxId.equals(trxId),
            new Error(
              `invalid transaction id; expected: ${trxId}, received: ${resMsg.header.trxId}.`,
            ),
          );
          return resMsg;
        }
      }
    } finally {
      this.#sock.close();
    }
  }
}

export type TcpAgentConfig = {
  address: string;
  port: number;
  tiMs?: number;
};

export class TcpAgent {
  #address: string;
  #port: number;
  #tiMs = 39_500;

  constructor(config: TcpAgentConfig) {
    this.#address = config.address;
    this.#port = config.port;
    this.#tiMs = config.tiMs ?? this.#tiMs;
  }

  async send(
    cls: Extract<MsgClass, "Indication">,
    method: MsgMethod,
  ): Promise<undefined>;
  async send(
    cls: Extract<MsgClass, "Request">,
    method: MsgMethod,
  ): Promise<StunMsg>;
  async send(cls: MsgClass, method: MsgMethod): Promise<undefined | StunMsg> {
    const trxId = randomBytes(12);
    const hBuf = encodeHeader({
      cls,
      method,
      trxId,
      length: 0,
    });
    switch (cls) {
      case "Indication": {
        await new Promise<void>((resolve, reject) => {
          const sock = createConnection(this.#port, this.#address, () => {
            sock.write(hBuf);
            sock.end();
            resolve();
          });
          sock.on("error", (err) => {
            sock.end();
            reject(err);
          });
        });
        return;
      }
      case "Request": {
        const resBuf = await new Promise<Buffer>((resolve, reject) => {
          const sock = createConnection(
            { port: this.#port, host: this.#address, timeout: this.#tiMs },
            () => {
              sock.write(hBuf);
            },
          );
          sock.on("data", (data) => {
            sock.end();
            resolve(data);
          });
          sock.on("error", (err) => {
            sock.end();
            throw err;
          });
          sock.on("timeout", () => {
            sock.end();
            reject(new Error("reached timeout"));
          });
        });
        assertStunMSg(resBuf);
        const resMsg = decodeStunMsg(resBuf);
        return resMsg;
      }
    }
  }
}
