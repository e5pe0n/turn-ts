import type { Override, Result } from "@e5pe0n/lib";
import {
  type Protocol,
  type RawStunMsg,
  type RemoteInfo,
  encodeMessageIntegrityValue,
} from "@e5pe0n/stun-ts";
import { createSocket, type Socket } from "node:dgram";
import { Allocator } from "./alloc.js";
import { handleAllocate } from "./handlers/alloc.js";
import { handleCreatePermission } from "./handlers/perm.js";
import { handleSend } from "./handlers/send.js";
import { TurnMsg } from "./msg.js";

// TODO: enable to set config from environment variables
export const defaultServerConfig = {
  protocol: "udp",
  nonce: "nonce",
  host: "127.0.0.1",
  port: 3478,
  software: "@e5pe0n/turn-ts@0.0.0 server",
  maxLifetimeSec: 3600,
} as const;

export type InitServerConfig = Override<
  ServerConfig,
  {
    [K in keyof typeof defaultServerConfig]?: ServerConfig[K];
  }
>;

export type ServerConfig = {
  protocol: Protocol;
  host: string;
  serverAddress: string;
  port: number;
  username: string;
  password: string;
  realm: string;
  // TODO: nonce should be generated randomly regularly
  nonce: string;
  software?: string;
  maxLifetimeSec: number;
};

export class Server {
  #config: ServerConfig;
  #allocator: Allocator;
  #sock: Socket;

  constructor(config: InitServerConfig) {
    this.#config = {
      ...defaultServerConfig,
      ...config,
    };
    this.#sock = createSocket("udp4");
    this.#sock.on("message", async (msg, rinfo) => {
      try {
        // TODO: output log depending on env var or config.
        // biome-ignore lint/suspicious/noConsole: tmp
        console.log(`received udp message; rinfo=${JSON.stringify(rinfo)}`);
        const buf = await this.#handleMsg(msg, rinfo);
        if (buf) {
          this.#sock.send(buf, rinfo.port, rinfo.address);
          // TODO: output log depending on env var or config.
          // biome-ignore lint/suspicious/noConsole: tmp
          console.log(`returned udp message; rinfo=${JSON.stringify(rinfo)}`);
        }
      } catch (err) {
        // biome-ignore lint/suspicious/noConsole: ignore error
        console.error(err);
      }
    });
    this.#allocator = new Allocator({
      ...this.#config,
      serverTransportAddress: {
        // TODO: support IPv6
        family: "IPv4",
        address: this.#config.serverAddress,
        port: this.#config.port,
      },
      serverSock: this.#sock,
    });
  }

  async #handleMsg(data: Buffer, rinfo: RemoteInfo) {
    // TODO: impl message handler
    const msg = TurnMsg.from(data);
    console.log("msg:", msg);
    switch (msg.header.cls) {
      case "indication":
        switch (msg.header.method) {
          case "send":
            {
              const res = handleSend(msg, {
                ...this.#config,
                rinfo,
                allocator: this.#allocator,
                transportProtocol: this.#config.protocol,
              });
              if (res.success) {
                // TODO: output log depending on env var or config.
                // biome-ignore lint/suspicious/noConsole: tmp
                console.log("send success");
              } else {
                // TODO: output log depending on env var or config.
                // biome-ignore lint/suspicious/noConsole: tmp
                console.log("send error:", res.error);
              }
            }
            break;
          default: {
            // TODO: output log depending on env var or config.
            // biome-ignore lint/suspicious/noConsole: tmp
            console.log("unknown method:", msg.header.method);
          }
        }
        break;
      case "request": {
        const authRes = authReq(msg, this.#config);
        if (!authRes.success) {
          console.log("auth error:", authRes.error);
          return authRes.error.raw;
        }
        switch (msg.header.method) {
          case "allocate": {
            const resp = await handleAllocate(msg, {
              ...this.#config,
              rinfo,
              allocator: this.#allocator,
              transportProtocol: this.#config.protocol,
              serverInfo: {
                software: this.#config.software,
              },
            });
            return resp.raw;
          }
          case "createPermission": {
            const resp = await handleCreatePermission(msg, {
              ...this.#config,
              rinfo,
              allocator: this.#allocator,
              transportProtocol: this.#config.protocol,
            });
            return resp.raw;
          }
          default: {
            // TODO: output log depending on env var or config.
            // biome-ignore lint/suspicious/noConsole: tmp
            console.log("unknown method:", msg.header.method);
          }
        }
      }
    }
  }

  listen() {
    this.#sock.bind(this.#config.port, this.#config.host);
  }

  close() {
    this.#sock.close();
  }
}

export function authReq(
  req: TurnMsg,
  {
    username,
    password,
    realm,
    nonce,
    software,
  }: {
    username: string;
    password: string;
    realm: string;
    nonce: string;
    software?: string;
  },
): Result<undefined, TurnMsg> {
  if (!req.attrs.messageIntegrity) {
    return {
      success: false,
      error: TurnMsg.build({
        header: {
          cls: "errorResponse",
          method: req.header.method,
          trxId: req.header.trxId,
        },
        attrs: {
          software,
          errorCode: { code: 401, reason: "Unauthorized" },
          realm,
          nonce,
        },
      }),
    };
  }
  if (!(req.attrs.username && req.attrs.realm && req.attrs.nonce)) {
    return {
      success: false,
      error: TurnMsg.build({
        header: {
          cls: "errorResponse",
          method: req.header.method,
          trxId: req.header.trxId,
        },
        attrs: {
          software,
          errorCode: { code: 400, reason: "Bad Request" },
        },
      }),
    };
  }

  // TODO: impl NONCE check

  if (req.attrs.username !== username) {
    return {
      success: false,
      error: TurnMsg.build({
        header: {
          cls: "errorResponse",
          method: req.header.method,
          trxId: req.header.trxId,
        },
        attrs: {
          software,
          errorCode: { code: 401, reason: "Unauthorized" },
          realm,
          nonce,
        },
      }),
    };
  }

  const msgIntegrity = encodeMessageIntegrityValue({
    credentials: {
      term: "long",
      username,
      password,
      realm,
    },
    raw: req.raw.subarray(0, req.msgIntegrityOffset) as RawStunMsg,
  });
  if (!req.attrs.messageIntegrity.equals(msgIntegrity)) {
    return {
      success: false,
      error: TurnMsg.build({
        header: {
          cls: "errorResponse",
          method: req.header.method,
          trxId: req.header.trxId,
        },
        attrs: {
          software,
          errorCode: { code: 401, reason: "Unauthorized" },
          realm,
          nonce,
        },
      }),
    };
  }

  return {
    success: true,
    value: undefined,
  };
}
