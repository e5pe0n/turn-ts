import { msgMethodRecord as stunMsgMethodRecord } from "@e5pe0n/stun-ts/src/header.js";

export const turnMsgMethodRecord = {
  Allocate: 0x0003,
  // Refresh: 0x004,
  // Send: 0x006,
  // Data: 0x007,
  // CreatePermission: 0x008,
  // ChannelBind: 0x009,
  ...stunMsgMethodRecord,
} as const;
export type TurnMsgMethods = typeof turnMsgMethodRecord;
export type MsgMethod = keyof TurnMsgMethods;
