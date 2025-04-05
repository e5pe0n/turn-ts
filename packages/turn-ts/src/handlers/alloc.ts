import type { Protocol, RemoteInfo } from "@e5pe0n/stun-ts";
import type { AllocationManager } from "../alloc.js";
import { TurnMsg } from "../msg.js";
import { handleData } from "./data.js";

// https://datatracker.ietf.org/doc/html/rfc5766#section-6.2
export async function handleAllocate(
  msg: TurnMsg,
  {
    allocManager,
    rinfo,
    transportProtocol,
    serverInfo,
  }: {
    allocManager: AllocationManager;
    rinfo: RemoteInfo;
    transportProtocol: Protocol;
    serverInfo: {
      software: string;
    };
  },
): Promise<TurnMsg> {
  if (!(msg.header.cls === "request" && msg.header.method === "allocate")) {
    return TurnMsg.build({
      header: {
        cls: "errorResponse",
        method: msg.header.method,
        trxId: msg.header.trxId,
      },
      attrs: {
        errorCode: { code: 400, reason: "Bad Request" },
      },
    });
  }

  if (!msg.attrs.requestedTransport) {
    return TurnMsg.build({
      header: {
        cls: "errorResponse",
        method: msg.header.method,
        trxId: msg.header.trxId,
      },
      attrs: {
        errorCode: { code: 400, reason: "Bad Request" },
      },
    });
  }

  // TODO: move this to where TurnMsg.from() is called
  if (msg.attrs.requestedTransport !== "udp") {
    return TurnMsg.build({
      header: {
        cls: "errorResponse",
        method: msg.header.method,
        trxId: msg.header.trxId,
      },
      attrs: {
        errorCode: { code: 442, reason: "Unsupported Transport Protocol" },
      },
    });
  }

  const res = await allocManager.allocate(
    {
      clientTransportAddress: rinfo,
      transportProtocol,
      timeToExpirySec: msg.attrs.lifetime,
    },
    handleData,
  );
  // TODO: handle other errors
  if (!res.success) {
    return TurnMsg.build({
      header: {
        cls: "errorResponse",
        method: msg.header.method,
        trxId: msg.header.trxId,
      },
      attrs: {
        errorCode: { code: 437, reason: "Allocation Mismatch" },
      },
    });
  }

  return TurnMsg.build({
    header: {
      cls: "successResponse",
      method: "allocate",
      trxId: msg.header.trxId,
    },
    attrs: {
      lifetime: res.value.timeToExpirySec,
      software: serverInfo.software,
    },
  });
}
