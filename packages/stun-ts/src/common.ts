import { z } from "zod";

export const magicCookie = 0x2112a442 as const;

export const addrFamilySchema = z.union([z.literal("IPv4"), z.literal("IPv6")]);
export type AddrFamily = z.infer<typeof addrFamilySchema>;

export const logPrefix = "[stun-ts]";
