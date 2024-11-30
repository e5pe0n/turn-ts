import { type Socket, createSocket } from "node:dgram";
import { type Server, createServer } from "node:net";
import { z } from "zod";
import { assertRawStunFmtMsg } from "./agent.js";
import { type StunMsg, decodeStunMsg } from "./msg.js";
import type { Protocol, RawStunFmtMsg } from "./types.js";

const remoteInfoSchema = z.object({
  family: z.union([z.literal("IPv4"), z.literal("IPv6")]),
  address: z.string().ip(),
  port: z.number(),
});

export type RemoteInfo = z.infer<typeof remoteInfoSchema>;

export type MsgHandler = (msg: StunMsg, rinfo: RemoteInfo) => RawStunFmtMsg;

export interface Listener {
  protocol: Protocol;
  listen(port: number, host?: string): void;
  close(): void;
}

class UdpListener implements Listener {
  #protocol: Protocol;
  #sock: Socket;

  constructor(handler: MsgHandler) {
    this.#protocol = "udp";
    this.#sock = createSocket("udp4");
    this.#sock.on("message", (msg, rinfo) => {
      try {
        assertRawStunFmtMsg(msg);
        const decodedMsg = decodeStunMsg(msg);
        const resMsg = handler(decodedMsg, rinfo);
        this.#sock.send(resMsg, rinfo.port, rinfo.address);
      } catch (err) {
        // biome-ignore lint/suspicious/noConsole: ignore error
        console.error(err);
      }
    });
  }

  get protocol() {
    return this.#protocol;
  }

  listen(port: number, host?: string) {
    this.#sock.bind(port, host);
  }

  close() {
    this.#sock.close();
  }
}

class TcpListener implements Listener {
  #protocol: Protocol;
  #server: Server;

  constructor(handler: MsgHandler) {
    this.#protocol = "tcp";
    this.#server = createServer((sock) => {
      sock.on("data", (msg) => {
        const maybeRinfo = sock.address();
        const rinfo = remoteInfoSchema.parse(maybeRinfo);
        try {
          assertRawStunFmtMsg(msg);
          const decodedMsg = decodeStunMsg(msg);
          const resMsg = handler(decodedMsg, rinfo);
          sock.write(resMsg);
        } catch (err) {
          // biome-ignore lint/suspicious/noConsole: ignore error
          console.error(err);
        }
      });
    });
  }

  get protocol() {
    return this.#protocol;
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
