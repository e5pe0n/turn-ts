import type { Protocol, RemoteInfo } from "@e5pe0n/stun-ts";
import type { AllocationManager } from "./alloc.js";
import type { TurnMsg } from "./msg.js";

export async function handleSend(
  msg: TurnMsg,
  {
    allocManager,
    rinfo,
    transportProtocol,
    sender,
  }: {
    allocManager: AllocationManager;
    rinfo: RemoteInfo;
    transportProtocol: Protocol;
    sender: (data: Buffer, to: RemoteInfo) => Promise<void>;
  },
): Promise<void> {
  if (!(msg.header.cls === "indication" && msg.header.method === "send")) {
    // TODO: output log depending on env var or config.
    // biome-ignore lint/suspicious/noConsole: tmp
    console.log("Bad Request: invalid class or method.");
    return;
  }

  if (!(msg.attrs.xorPeerAddress && msg.attrs.data)) {
    // TODO: output log depending on env var or config.
    // biome-ignore lint/suspicious/noConsole: tmp
    console.log("Bad Request: xorPeerAddress or data is missing.");
    return;
  }

  const alloc = allocManager.get({
    clientTransportAddress: rinfo,
    transportProtocol,
  });
  if (!alloc) {
    // TODO: output log depending on env var or config.
    // biome-ignore lint/suspicious/noConsole: tmp
    console.log("Allocation does not exist.");
    return;
  }

  if (!alloc.permissions.includes(msg.attrs.xorPeerAddress.address)) {
    // TODO: output log depending on env var or config.
    // biome-ignore lint/suspicious/noConsole: tmp
    console.log(`permission does not exist on Allocation(id=). ${alloc.id}`);
    return;
  }

  sender(msg.attrs.data!, msg.attrs.xorPeerAddress!);
}
