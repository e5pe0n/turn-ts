import { retry } from "@e5pe0n/lib";
import { type Socket, createSocket } from "node:dgram";
import { type Socket as TcpSocket, createConnection } from "node:net";

export interface Agent {
  close(): void;
  indicate(msg: Buffer): Promise<undefined>;
  request(msg: Buffer): Promise<Buffer>;
}

export type UdpAgentInitConfig = {
  to: {
    address: string;
    port: number;
  };
  rtoMs?: number;
  rc?: number;
  rm?: number;
};

export type UdpAgentConfig = Required<UdpAgentInitConfig>;
export class UdpAgent implements Agent {
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
    this.#sock.bind();
  }

  close(): void {
    this.#sock.close();
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
    const _res = new Promise<Buffer>((resolve, reject) => {
      this.#sock.on("message", (msg) => {
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

    const res = (await Promise.race([
      retry(_req, {
        retryIf: () => true,
        maxAttempts: this.#config.rc,
        intervalMs: (numAttempts: number) => this.#config.rtoMs * numAttempts,
        attemptTimeoutMs: this.#config.rtoMs * this.#config.rm,
      }),
      _res,
    ])) as Buffer;
    return res;
  }
}

export type TcpAgentInitConfig = {
  to: {
    address: string;
    port: number;
  };
  tiMs?: number;
};

export type TcpAgentConfig = Required<TcpAgentInitConfig>;

export class TcpAgent implements Agent {
  #config: TcpAgentConfig;
  #sock?: TcpSocket;

  constructor(config: TcpAgentInitConfig) {
    this.#config = {
      tiMs: 39_500,
      ...config,
    };
  }

  close(): void {
    this.#sock?.destroy();
  }

  async indicate(msg: Buffer): Promise<undefined> {
    await new Promise<void>((resolve, reject) => {
      const sock = createConnection(
        this.#config.to.port,
        this.#config.to.address,
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
      this.#sock = sock;
    });
    return;
  }

  async request(msg: Buffer): Promise<Buffer> {
    const resBuf = await new Promise<Buffer>((resolve, reject) => {
      const sock = createConnection(
        {
          port: this.#config.to.port,
          host: this.#config.to.address,
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
        reject(err);
      });
      sock.on("timeout", () => {
        sock.end();
        reject(new Error("reached timeout"));
      });
      this.#sock = sock;
    });
    return resBuf;
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
