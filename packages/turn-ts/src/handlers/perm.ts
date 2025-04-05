import type { Protocol, RemoteInfo } from "@e5pe0n/stun-ts";
import type { Allocator } from "../alloc.js";
import { TurnMsg } from "../msg.js";

export async function handleCreatePermission(
  msg: TurnMsg,
  {
    allocator,
    rinfo,
    transportProtocol,
  }: {
    allocator: Allocator;
    rinfo: RemoteInfo;
    transportProtocol: Protocol;
  },
): Promise<TurnMsg> {
  if (
    !(msg.header.cls === "request" && msg.header.method === "createPermission")
  ) {
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

  if (!msg.attrs.xorPeerAddress) {
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

  const alloc = allocator.get({
    clientTransportAddress: rinfo,
    transportProtocol,
  });
  if (!alloc) {
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
  allocator.installPermission(alloc.id, msg.attrs.xorPeerAddress);

  return TurnMsg.build({
    header: {
      cls: "successResponse",
      method: msg.header.method,
      trxId: msg.header.trxId,
    },
    attrs: {},
  });
}
