import type { TransportAddress, Protocol } from "@e5pe0n/stun-ts";
import { TurnMsg } from "./msg.js";
import type { RemoteInfo } from "@e5pe0n/stun-ts";
import { type Brand, withResolvers } from "@e5pe0n/lib";
import { createSocket, Socket } from "node:dgram";

type ValidateAllocReqReturn =
  | {
      success: true;
    }
  | {
      success: false;
      errorResp: TurnMsg;
    };

export function validateAllocReq(req: TurnMsg): ValidateAllocReqReturn {
  if (req.header.cls === "request" && req.header.method === "allocate") {
    return { success: true };
  }

  return {
    success: false,
    errorResp: TurnMsg.build({
      header: {
        cls: "errorResponse",
        method: req.header.method,
        trxId: req.header.trxId,
      },
      attrs: {
        errorCode: { code: 400, reason: "Bad Request" },
      },
    }),
  };
}

type Allocation = {
  relayedTransportAddress: TransportAddress;
  clientTransportAddress: TransportAddress;
  serverTransportAddress: TransportAddress;
  transportProtocol: Protocol;
  authInfo: {
    username: string;
    password: string;
    realm: string;
    nonce: string;
  };
  timeToExpire: number;
};

type AllocKey = Brand<string, "AllocKey">;

function createAllocKey(arg: {
  clientTransportAddress: TransportAddress;
  serverTransportAddress: TransportAddress;
  transportProtocol: Protocol;
}): AllocKey {
  return JSON.stringify(arg) as AllocKey;
}

async function bindSocket(serverHost: string) {
  const sock = createSocket("udp4");
  const { promise, resolve } = withResolvers<Socket>();
  sock.bind(
    {
      address: serverHost,
    },
    () => {
      resolve(sock);
    },
  );
  return await promise;
}

// https://datatracker.ietf.org/doc/html/rfc5766#section-6.2
export async function handleAllocReq(
  req: TurnMsg,
  {
    allocations,
    rinfo,
    serverTransportAddress,
    transportProtocol,
    serverHost,
  }: {
    allocations: Map<AllocKey, Allocation>;
    rinfo: RemoteInfo;
    serverTransportAddress: TransportAddress;
    transportProtocol: Protocol;
    serverHost: string;
  },
): TurnMsg {
  if (!(req.header.cls === "request" && req.header.method === "allocate")) {
    return TurnMsg.build({
      header: {
        cls: "errorResponse",
        method: req.header.method,
        trxId: req.header.trxId,
      },
      attrs: {
        errorCode: { code: 400, reason: "Bad Request" },
      },
    });
  }

  if (!req.attrs.requestedTransport) {
    return TurnMsg.build({
      header: {
        cls: "errorResponse",
        method: req.header.method,
        trxId: req.header.trxId,
      },
      attrs: {
        errorCode: { code: 400, reason: "Bad Request" },
      },
    });
  }

  if (req.attrs.requestedTransport !== "udp") {
    return TurnMsg.build({
      header: {
        cls: "errorResponse",
        method: req.header.method,
        trxId: req.header.trxId,
      },
      attrs: {
        errorCode: { code: 442, reason: "Unsupported Transport Protocol" },
      },
    });
  }

  const allocKey = createAllocKey({
    clientTransportAddress: rinfo,
    serverTransportAddress,
    transportProtocol,
  });
  if (allocations.has(allocKey)) {
    return TurnMsg.build({
      header: {
        cls: "errorResponse",
        method: req.header.method,
        trxId: req.header.trxId,
      },
      attrs: {
        errorCode: { code: 437, reason: "Allocation Mismatch" },
      },
    });
  }

  const sock = await bindSocket(serverHost);

  return TurnMsg.build({
    header: {
      cls: "successResponse",
      method: "allocate",
      trxId: req.header.trxId,
    },
    attrs: {
      lifetime: 1200,
    },
  });
}
