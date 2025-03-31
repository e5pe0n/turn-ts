import {
  type Listener,
  type Protocol,
  type RawStunMsg,
  createListener,
  encodeMessageIntegrityValue,
} from "@e5pe0n/stun-ts";
import { TurnMsg } from "./msg.js";

// TODO: enable to set config from environment variables
export const defaultServerConfig = {
  protocol: "udp",
  nonce: "nonce",
  host: "127.0.0.1",
  port: 3478,
  software: "@e5pe0n/turn-ts@0.0.0 server",
  maxLifetimeSec: 3600,
} as const satisfies Omit<ServerConfig, "username" | "password" | "realm">;

export type ServerConfig = {
  protocol: Protocol;
  host: string;
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

  constructor(config: ServerConfig) {
    this.#listener = createListener(config.protocol, (data, rinfo) => {
      // TODO: impl message handler
      return data;
    });
    this.#config = {
      ...defaultServerConfig,
      ...config,
    };
  }
}

type AuthReqReturn =
  | {
      success: true;
    }
  | {
      success: false;
      errorResp: TurnMsg;
    };

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
): AuthReqReturn {
  if (!req.attrs.messageIntegrity) {
    return {
      success: false,
      errorResp: TurnMsg.build({
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
      errorResp: TurnMsg.build({
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
      errorResp: TurnMsg.build({
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
      errorResp: TurnMsg.build({
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
  };
}
