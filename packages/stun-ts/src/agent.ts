import { type Override, retry } from "@e5pe0n/lib";
import { type Socket, createSocket } from "node:dgram";
import { type Socket as TcpSocket, createConnection } from "node:net";
import type { RemoteInfo } from "./listener.js";

export interface Agent {
  close(): void;
  indicate(msg: Buffer): Promise<undefined>;
  request(msg: Buffer): Promise<Buffer>;
  on(
    eventName: "indication",
    cb: (msg: Buffer, rinfo: RemoteInfo) => void,
  ): void;
}

export type UdpAgentInitConfig = {
  to: {
    address: string;
    port: number;
  };
  from?: {
    address?: string;
    port?: number;
  };
  rtoMs?: number;
  rc?: number;
  rm?: number;
};

export type UdpAgentConfig = Override<
  Required<UdpAgentInitConfig>,
  {
    from?: UdpAgentInitConfig["from"];
  }
>;

export class UdpAgent implements Agent {
  #config: UdpAgentConfig;
  #sock: Socket;
  #waitingResp = false;

  constructor(config: UdpAgentInitConfig) {
    this.#config = {
      rtoMs: 3000,
      rc: 7,
      rm: 16,
      ...config,
    };
    this.#sock = createSocket("udp4");
    this.#sock.bind(this.#config.from?.port, this.#config.from?.address);
  }

  close(): void {
    this.#sock.close();
  }

  on(_: "indication", cb: (msg: Buffer, rinfo: RemoteInfo) => void): void {
    this.#sock.on("message", (msg, info) => {
      if (!this.#waitingResp) {
        cb(msg, info);
      }
    });
  }

  async indicate(msg: Buffer): Promise<undefined> {
    await new Promise<void>((resolve, reject) => {
      this.#sock.send(
        msg,
        this.#config.to.port,
        this.#config.to.address,
        (err, bytes) => {
          if (err) {
            reject(err);
          }
          resolve();
        },
      );
    });
  }

  async request(msg: Buffer): Promise<Buffer> {
    this.#waitingResp = true;
    const _res = new Promise<Buffer>((resolve, reject) => {
      this.#sock.once("message", (msg) => {
        resolve(msg);
      });
    });
    const _req = async (): Promise<Error | null> =>
      new Promise((resolve, reject) => {
        this.#sock.send(
          msg,
          this.#config.to.port,
          this.#config.to.address,
          (errOrNull, bytes) => {
            resolve(errOrNull);
          },
        );
      });
    const resp = (await Promise.race([
      retry(_req, {
        retryIf: () => true,
        maxAttempts: this.#config.rc,
        intervalMs: (numAttempts: number) => this.#config.rtoMs * numAttempts,
        attemptTimeoutMs: this.#config.rtoMs * this.#config.rm,
      }),
      _res,
    ])) as Buffer;
    this.#waitingResp = false;
    return resp;
  }
}

export type TcpAgentInitConfig = {
  to: {
    address: string;
    port: number;
  };
  from?: {
    address?: string;
    port?: number;
  };
  tiMs?: number;
};

export type TcpAgentConfig = Override<
  Required<TcpAgentInitConfig>,
  {
    from?: TcpAgentInitConfig["from"];
  }
>;

export class TcpAgent implements Agent {
  #config: TcpAgentConfig;
  #sock: TcpSocket;
  #waitingResp = false;
  #errHandler?: (err: Error) => void;

  constructor(config: TcpAgentInitConfig) {
    this.#config = {
      tiMs: 39_500,
      ...config,
    };
    this.#sock = createConnection({
      port: this.#config.to.port,
      host: this.#config.to.address,
      localAddress: this.#config.from?.address,
      localPort: this.#config.from?.port,
    });
    this.#sock.on("error", (err) => {
      this.#errHandler?.(err);
    });
  }

  close(): void {
    this.#sock?.destroy();
  }

  on(_: "indication", cb: (msg: Buffer, rinfo: RemoteInfo) => void): void {
    this.#sock.on("message", (msg, info) => {
      if (!this.#waitingResp) {
        cb(msg, info);
      }
    });
  }

  async indicate(msg: Buffer): Promise<undefined> {
    await new Promise<void>((resolve, reject) => {
      this.#errHandler = (err) => {
        this.#sock.end();
        reject(err);
        this.#errHandler = undefined;
      };
      this.#sock.write(msg);
      this.#sock.end();
      resolve();
    });
    return;
  }

  async request(msg: Buffer): Promise<Buffer> {
    this.#waitingResp = true;
    const respBuf = await new Promise<Buffer>((resolve, reject) => {
      this.#sock.write(msg);
      this.#errHandler = (err) => {
        this.#sock.end();
        reject(err);
        this.#errHandler = undefined;
      };
      this.#sock.on("data", (data) => {
        this.#sock.end();
        resolve(data);
      });
      this.#sock.on("timeout", () => {
        this.#sock.end();
        reject(new Error("reached timeout"));
      });
    });
    this.#waitingResp = false;
    return respBuf;
  }
}

export type CreateAgentParams =
  | ({
      protocol: "udp";
    } & UdpAgentInitConfig)
  | ({
      protocol: "tcp";
    } & TcpAgentInitConfig);

export function createAgent(arg: CreateAgentParams): Agent {
  switch (arg.protocol) {
    case "udp":
      return new UdpAgent(arg);
    case "tcp":
      return new TcpAgent(arg);
    default:
      arg satisfies never;
      throw new Error(
        `invalid protocol: ${(arg as { protocol: string }).protocol} is not supported.`,
      );
  }
}
