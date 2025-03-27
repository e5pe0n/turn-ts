import type { AddrFamily } from "./common.js";
import type { Brand } from "@e5pe0n/lib";

export type Protocol = "udp" | "tcp";

export type RawStunMsg = Brand<Buffer, "RawStunMsg">;

export type TransportAddress = {
  family: AddrFamily;
  port: number;
  address: string;
};
