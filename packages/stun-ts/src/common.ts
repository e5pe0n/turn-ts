import { randomBytes } from "node:crypto";
import type { Brand } from "@e5pe0n/lib";
import { z } from "zod";

export const magicCookie = 0x2112a442 as const;

type TrxId = Brand<Buffer, "TrxId">;

export const TrxId = {
  new: () => Buffer.from(randomBytes(12)) as TrxId,
};

export const addrFamilySchema = z.union([z.literal("IPv4"), z.literal("IPv6")]);
export type AddrFamily = z.infer<typeof addrFamilySchema>;

export const logPrefix = "[stun-ts]";
