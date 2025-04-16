import { type RemoteInfo, TrxId } from "@e5pe0n/stun-ts";
import type { Allocation } from "../alloc.js";
import { TurnMsg } from "../msg.js";
import type { Result } from "@e5pe0n/lib";

export function handleData(
  data: Buffer,
  {
    alloc,
    rinfo,
  }: {
    alloc: Allocation;
    rinfo: RemoteInfo;
  },
): Result {
  if (!alloc.permissions.includes(rinfo.address)) {
    return {
      success: false,
      error: new Error(
        `Forbidden: Permission does not exist on Allocation(id=${alloc.id}).`,
      ),
    };
  }

  const msg = TurnMsg.build({
    header: {
      cls: "indication",
      method: "data",
      trxId: TrxId.new(),
    },
    attrs: {
      xorPeerAddress: rinfo,
      data,
    },
  });
  alloc.sock.send(
    msg.raw,
    alloc.clientTransportAddress.port,
    alloc.clientTransportAddress.address,
  );
  return { success: true, value: undefined };
}
