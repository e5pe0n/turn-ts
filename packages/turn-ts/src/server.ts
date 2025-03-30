import {
  type Listener,
  type Protocol,
  type RawStunMsg,
  createListener,
  encodeMessageIntegrityValue,
} from "@e5pe0n/stun-ts";
import { TurnMsg } from "./msg.js";

export type ServerConfig = {
  protocol: Protocol;
  username: string;
  password: string;
  realm: string;
  software?: string;
  maxLifetimeSec: number;
};

export class Server {
  #listener: Listener;
  #config: ServerConfig;

  constructor(config: ServerConfig) {
    this.#listener = createListener(config.protocol, (data, rinfo) => {});
    this.#config = {
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
