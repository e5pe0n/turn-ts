import { type Socket, createSocket } from "node:dgram";
import { type Server, createServer } from "node:net";
import { type AddrFamily, logPrefix } from "./common.js";
import type { Protocol } from "./types.js";

export type RemoteInfo = {
  family: AddrFamily;
  address: string;
  port: number;
};

export type MsgHandler = (data: Buffer, rinfo: RemoteInfo) => Buffer;

export interface Listener {
  listen(port: number, host?: string): void;
  close(): void;
}

class UdpListener implements Listener {
  #sock: Socket;

  constructor(handler: MsgHandler) {
    this.#sock = createSocket("udp4");
    this.#sock.on("message", (msg, rinfo) => {
      try {
        // TODO: output log depending on env var or config.
        // biome-ignore lint/suspicious/noConsole: example code
        console.log(
          `${logPrefix} received udp message; rinfo=${JSON.stringify(rinfo)}`,
        );
        const buf = handler(msg, rinfo);
        this.#sock.send(buf, rinfo.port, rinfo.address);
        // TODO: output log depending on env var or config.
        // biome-ignore lint/suspicious/noConsole: example code
        console.log(
          `${logPrefix} returns udp message; rinfo=${JSON.stringify(rinfo)}`,
        );
      } catch (err) {
        // biome-ignore lint/suspicious/noConsole: ignore error
        console.error(err);
      }
    });
  }

  listen(port: number, host?: string) {
    this.#sock.bind(port, host);
  }

  close() {
    this.#sock.close();
  }
}

class TcpListener implements Listener {
  #server: Server;

  constructor(handler: MsgHandler) {
    this.#server = createServer((sock) => {
      sock.on("data", (msg) => {
        if (!(sock.remoteFamily && sock.remoteAddress && sock.remotePort)) {
          return;
        }
        const rinfo = {
          family: sock.remoteFamily,
          address: sock.remoteAddress,
          port: sock.remotePort,
        } as RemoteInfo;

        // TODO: output log depending on env var or config.
        // biome-ignore lint/suspicious/noConsole: example code
        console.log(
          `${logPrefix} received tcp message; rinfo=${JSON.stringify(rinfo)}`,
        );
        try {
          const buf = handler(msg, rinfo);
          sock.write(buf);
          // TODO: output log depending on env var or config.
          // biome-ignore lint/suspicious/noConsole: example code
          console.log(
            `${logPrefix} returns tcp message; rinfo=${JSON.stringify(rinfo)}`,
          );
        } catch (err) {
          // biome-ignore lint/suspicious/noConsole: ignore error
          console.error(err);
        }
      });
    });
  }

  listen(port: number, host?: string) {
    this.#server.listen(port, host);
  }

  close() {
    this.#server.close();
  }
}

export function createListener(
  protocol: Protocol,
  handler: MsgHandler,
): Listener {
  switch (protocol) {
    case "udp":
      return new UdpListener(handler);
    case "tcp":
      return new TcpListener(handler);
    default:
      throw new Error(`invalid protocol: ${protocol} is not supported.`);
  }
}
