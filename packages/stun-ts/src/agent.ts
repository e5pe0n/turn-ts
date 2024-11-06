import { type Socket, createSocket } from "node:dgram";
import { createConnection } from "node:net";
import { magicCookie } from "./consts.js";
import { readMagicCookie } from "./header.js";
import { assert, retry } from "./helpers.js";
import type { RawStunMsg } from "./types.js";

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

export type UdpAgentInitConfig = {
  dest: {
    address: string;
    port: number;
  };
  rtoMs?: number;
  rc?: number;
  rm?: number;
};

export type UdpAgentConfig = Required<UdpAgentInitConfig>;

export class UdpAgent {
  #config: UdpAgentConfig;
  #sock: Socket;

  constructor(config: UdpAgentInitConfig) {
    this.#config = {
      rtoMs: 3000,
      rc: 7,
      rm: 16,
      ...config,
    };
    this.#sock = createSocket("udp4");
  }

  get config(): UdpAgentConfig {
    return structuredClone(this.#config);
  }

  async indicate(msg: RawStunMsg): Promise<undefined> {
    this.#sock.bind();
    try {
      await new Promise<void>((resolve, reject) => {
        this.#sock.send(
          msg,
          this.#config.dest.port,
          this.#config.dest.address,
          (err, bytes) => {
            if (err) {
              reject(err);
            }
            resolve();
          },
        );
      });
    } finally {
      this.#sock.close();
    }
  }

  async request(msg: RawStunMsg): Promise<RawStunMsg> {
    this.#sock.bind();
    try {
      const _res = new Promise<Buffer>((resolve, reject) => {
        this.#sock.on("message", (msg) => {
          resolve(msg);
        });
      });
      const _req = async (): Promise<void> =>
        new Promise((resolve, reject) => {
          this.#sock.send(
            msg,
            this.#config.dest.port,
            this.#config.dest.address,
            (err, bytes) => {
              reject(err);
            },
          );
        });

      const resBuf = (await Promise.race([
        retry(
          _req,
          this.#config.rc,
          (numAttempts: number) => this.#config.rtoMs * numAttempts,
          this.#config.rtoMs * this.#config.rm,
        ),
        _res,
      ])) as Buffer;
      assertStunMSg(resBuf);
      return resBuf;
    } finally {
      this.#sock.close();
    }
  }
}

export type TcpAgentInitConfig = {
  dest: {
    address: string;
    port: number;
  };
  tiMs?: number;
};

export type TcpAgentConfig = Required<TcpAgentInitConfig>;

export class TcpAgent {
  #config: TcpAgentConfig;

  constructor(config: TcpAgentInitConfig) {
    this.#config = {
      tiMs: 39_500,
      ...config,
    };
  }

  get config(): TcpAgentConfig {
    return structuredClone(this.#config);
  }

  async indicate(msg: RawStunMsg): Promise<undefined> {
    await new Promise<void>((resolve, reject) => {
      const sock = createConnection(
        this.#config.dest.port,
        this.#config.dest.address,
        () => {
          sock.write(msg);
          sock.end();
          resolve();
        },
      );
      sock.on("error", (err) => {
        sock.end();
        reject(err);
      });
    });
    return;
  }

  async request(msg: RawStunMsg): Promise<RawStunMsg> {
    const resBuf = await new Promise<Buffer>((resolve, reject) => {
      const sock = createConnection(
        {
          port: this.#config.dest.port,
          host: this.#config.dest.address,
          timeout: this.#config.tiMs,
        },
        () => {
          sock.write(msg);
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
    return resBuf;
  }
}
