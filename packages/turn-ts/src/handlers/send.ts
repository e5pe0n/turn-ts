import type { Protocol, RemoteInfo } from "@e5pe0n/stun-ts";
import type { Allocator } from "../alloc.js";
import type { TurnMsg } from "../msg.js";
import type { Result } from "@e5pe0n/lib";

export function handleSend(
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
): Result {
  if (!(msg.header.cls === "indication" && msg.header.method === "send")) {
    return {
      success: false,
      error: new Error("Bad Request: invalid class or method."),
    };
  }

  if (!(msg.attrs.xorPeerAddress && msg.attrs.data)) {
    return {
      success: false,
      error: new Error("Bad Request: xorPeerAddress or data is missing."),
    };
  }

  const alloc = allocator.get({
    clientTransportAddress: rinfo,
    transportProtocol,
  });
  if (!alloc) {
    return {
      success: false,
      error: new Error("Allocation Mismatch: Allocation does not exist."),
    };
  }

  if (!alloc.permissions.includes(msg.attrs.xorPeerAddress.address)) {
    return {
      success: false,
      error: new Error("Forbidden: Permission does not exist."),
    };
  }

  alloc.sock.send(
    msg.attrs.data,
    msg.attrs.xorPeerAddress.port,
    msg.attrs.xorPeerAddress.address,
  );
  return { success: true, value: undefined };
}
