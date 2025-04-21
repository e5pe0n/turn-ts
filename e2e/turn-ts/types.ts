import type { TransportAddress } from "../../packages/stun-ts/src/types.js";

export type ClientMsg = {
  msg: string;
  xorRelayedAddress: TransportAddress;
};
