import { type RemoteInfo, TrxId } from "@e5pe0n/stun-ts";
import type { Allocation } from "../alloc.js";
import { TurnMsg } from "../msg.js";

export async function handleData(
  data: Buffer,
  {
    alloc,
    rinfo,
    sender,
  }: {
    alloc: Allocation;
    rinfo: RemoteInfo;
    sender: (msg: TurnMsg) => void;
  },
): Promise<void> {
  if (!alloc.permissions.includes(rinfo.address)) {
    // TODO: output log depending on env var or config.
    // biome-ignore lint/suspicious/noConsole: tmp
    console.log(`permission does not exist on Allocation(id=${alloc.id}).`);
    return;
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
  sender(msg);
}
