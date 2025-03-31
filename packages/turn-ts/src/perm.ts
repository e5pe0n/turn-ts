import type { Protocol, RemoteInfo } from "@e5pe0n/stun-ts";
import type { AllocationManager } from "./alloc.js";
import { TurnMsg } from "./msg.js";

export async function handleCreatePermissionReq(
  req: TurnMsg,
  {
    allocManager,
    rinfo,
    transportProtocol,
  }: {
    allocManager: AllocationManager;
    rinfo: RemoteInfo;
    transportProtocol: Protocol;
  },
): Promise<TurnMsg> {
  if (
    !(req.header.cls === "request" && req.header.method === "createPermission")
  ) {
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

  if (!req.attrs.xorPeerAddress) {
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

  const alloc = allocManager.get({
    clientTransportAddress: rinfo,
    transportProtocol,
  });
  if (!alloc) {
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
  alloc.permissions.push(req.attrs.xorPeerAddress);

  return TurnMsg.build({
    header: {
      cls: "successResponse",
      method: req.header.method,
      trxId: req.header.trxId,
    },
    attrs: {},
  });
}
