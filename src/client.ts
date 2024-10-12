import { randomBytes } from "node:crypto";
import { type Socket, createSocket } from "node:dgram";
import { compReqAttrTypeRecord } from "./attr.js";
import { classRecord, encodeHeader, methodRecord } from "./header.js";
import { retry } from "./helpers.js";
import { decodeStunMsg } from "./msg.js";
import type { Protocol } from "./types.js";

export type MessageClass = Extract<keyof typeof classRecord, "request">;
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

export type ClientConfig = {
  address: string;
  port: number;
  protocol: Protocol;
  rtoMs?: number;
  rc?: number;
  rm?: number;
};

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

export class Client {
  #address: string;
  #port: number;
  #protocol: Protocol;
  #sock: Socket;
  #rtoMs = 3000;
  #rc = 7;
  #rm = 16;

  constructor(config: ClientConfig) {
    this.#address = config.address;
    this.#port = config.port;
    this.#protocol = config.protocol;
    this.#sock = createSocket("udp4");
    this.#rtoMs = config.rtoMs ?? this.#rtoMs;
    this.#rc = config.rc ?? this.#rc;
    this.#rm = config.rm ?? this.#rm;
  }

  async send(cls: MessageClass, method: MessageMethod): Promise<Response> {
    const trxId = randomBytes(12);
    const hBuf = encodeHeader({
      cls: classRecord[cls],
      method: methodRecord[method],
      trxId,
      length: 0,
    });
    this.#sock.bind();
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
    this.#sock.close();
    const res = decodeResponse(resMsg, trxId);
    return res;
  }
}
