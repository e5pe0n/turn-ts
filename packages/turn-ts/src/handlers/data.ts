import { type RawStunMsg, type RemoteInfo, TrxId } from "@e5pe0n/stun-ts";
import type { Allocation } from "../alloc.js";
import { TurnMsg } from "../msg.js";
import type { Result } from "@e5pe0n/lib";

export function handleData(
  data: Buffer,
  {
    alloc,
    rinfo,
    sender,
  }: {
    alloc: Allocation;
    rinfo: RemoteInfo;
    sender: (msg: RawStunMsg, rinfo: RemoteInfo) => void;
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
  sender(msg.raw, alloc.clientTransportAddress);
  return { success: true, value: undefined };
}
