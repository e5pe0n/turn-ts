import type { Override, Result } from "@e5pe0n/lib";
import {
  type Listener,
  type Protocol,
  type RawStunMsg,
  createListener,
  encodeMessageIntegrityValue,
} from "@e5pe0n/stun-ts";
import { createSocket } from "node:dgram";
import { Allocator } from "./alloc.js";
import { handleAllocate } from "./handlers/alloc.js";
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
  #listener: Listener;
  #config: ServerConfig;
  #allocator: Allocator;

  constructor(config: InitServerConfig) {
    this.#config = {
      ...defaultServerConfig,
      ...config,
    };
    this.#allocator = new Allocator({
      ...this.#config,
      serverTransportAddress: {
        // TODO: support IPv6
        family: "IPv4",
        address: this.#config.serverAddress,
        port: this.#config.port,
      },
    });
    this.#listener = createListener(
      this.#config.protocol,
      async (data, rinfo) => {
        // TODO: impl message handler
        const msg = TurnMsg.from(data);
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
              default: {
                // TODO: output log depending on env var or config.
                // biome-ignore lint/suspicious/noConsole: tmp
                console.log("unknown method:", msg.header.method);
              }
            }
          }
        }
      },
    );
  }

  listen() {
    this.#listener.listen(this.#config.port, this.#config.host);
  }

  close() {
    this.#listener.close();
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
