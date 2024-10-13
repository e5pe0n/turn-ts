import { randomBytes } from "node:crypto";
import { type Socket, createSocket } from "node:dgram";
import { createConnection } from "node:net";
import { compReqAttrTypeRecord } from "./attr.js";
import { classRecord, encodeHeader, methodRecord } from "./header.js";
import { retry } from "./helpers.js";
import { decodeStunMsg } from "./msg.js";
import type { Protocol } from "./types.js";

export type MessageClass = Extract<
  keyof typeof classRecord,
  "request" | "indication"
>;
export type MessageMethod = keyof typeof methodRecord;

export type ErrorResponse = {
  success: false;
  code: number;
  reason: string;
};

export type SuccessResponse = {
  success: true;
  address: string; // Reflexive Transport Address
  port: number;
};

export type Response = SuccessResponse | ErrorResponse;

export type UdpClientConfig = {
  protocol: "udp";
  address: string;
  port: number;
  rtoMs?: number;
  rc?: number;
  rm?: number;
};

export type TcpClientConfig = {
  protocol: "tcp";
  address: string;
  port: number;
  tiMs?: number;
};

export type ClientConfig = UdpClientConfig | TcpClientConfig;

function fAddr(buf: Buffer): string {
  return Array.from(buf.values()).map(String).join(".");
}

function decodeResponse(buf: Buffer, trxId: Buffer): Response {
  const {
    header: { trxId: resTrxId },
    attrs,
  } = decodeStunMsg(buf);
  if (!trxId.equals(resTrxId)) {
    throw new Error(
      `invalid transaction id; expected: ${trxId}, actual: ${resTrxId}.`,
    );
  }
  const { type, value } = attrs[0]!;
  switch (type) {
    case compReqAttrTypeRecord["XOR-MAPPED-ADDRESS"]:
      return {
        success: true,
        port: value.port,
        address: fAddr(value.addr),
      };
    case compReqAttrTypeRecord["ERROR-CODE"]:
      return {
        success: false,
        code: value.code,
        reason: value.reason,
      };
    default:
      throw new Error(`invalid attr type: ${type} is not supported.`);
  }
}

export function createClient(config: UdpClientConfig): UdpClient;
export function createClient(config: TcpClientConfig): TcpClient;
export function createClient(config: ClientConfig): UdpClient | TcpClient {
  switch (config.protocol) {
    case "udp":
      return new UdpClient(config);
    case "tcp":
      return new TcpClient(config);
  }
}
class UdpClient {
  #protocol: Protocol;
  #address: string;
  #port: number;
  #sock: Socket;
  #rtoMs = 3000;
  #rc = 7;
  #rm = 16;

  constructor(config: UdpClientConfig) {
    this.#address = config.address;
    this.#port = config.port;
    this.#protocol = config.protocol;
    this.#sock = createSocket("udp4");
    this.#rtoMs = config.rtoMs ?? this.#rtoMs;
    this.#rc = config.rc ?? this.#rc;
    this.#rm = config.rm ?? this.#rm;
  }

  async send(
    cls: Extract<MessageClass, "indication">,
    method: MessageMethod,
  ): Promise<undefined>;
  async send(
    cls: Extract<MessageClass, "request">,
    method: MessageMethod,
  ): Promise<Response>;
  async send(
    cls: MessageClass,
    method: MessageMethod,
  ): Promise<undefined | Response> {
    const trxId = randomBytes(12);
    const hBuf = encodeHeader({
      cls: classRecord[cls],
      method: methodRecord[method],
      trxId,
      length: 0,
    });
    this.#sock.bind();
    try {
      switch (cls) {
        case "indication":
          await new Promise<void>((resolve, reject) => {
            this.#sock.send(hBuf, this.#port, this.#address, (err, bytes) => {
              if (err) {
                reject(err);
              }
              resolve();
            });
          });
          return;
        case "request": {
          const _res = async (): Promise<Buffer> =>
            new Promise((resolve, reject) => {
              this.#sock.on("message", (msg) => {
                return resolve(msg);
              });
            });
          const _req = async (): Promise<void> =>
            new Promise((resolve, reject) => {
              this.#sock.send(hBuf, this.#port, this.#address, (err, bytes) => {
                if (err) {
                  reject(err);
                }
                reject();
              });
            });

          const resMsg = (await Promise.race([
            retry(
              _req,
              this.#rc,
              (numAttemps: number) => this.#rtoMs * numAttemps,
              this.#rtoMs * this.#rm,
            ),
            _res(),
          ])) as Buffer;
          const res = decodeResponse(resMsg, trxId);
          return res;
        }
      }
    } finally {
      this.#sock.close();
    }
  }
}

class TcpClient {
  #protocol: Protocol;
  #address: string;
  #port: number;
  #tiMs = 39_500;

  constructor(config: TcpClientConfig) {
    this.#protocol = config.protocol;
    this.#address = config.address;
    this.#port = config.port;
    this.#tiMs = config.tiMs ?? this.#tiMs;
  }

  async send(
    cls: Extract<MessageClass, "indication">,
    method: MessageMethod,
  ): Promise<void> {
    const trxId = randomBytes(12);
    const hBuf = encodeHeader({
      cls: classRecord[cls],
      method: methodRecord[method],
      trxId,
      length: 0,
    });
    const sock = createConnection(this.#port, this.#address, () => {
      sock.write(hBuf);
      sock.end();
    });
    sock.on("error", (err) => {
      sock.end();
      throw err;
    });
  }
}
