export const msgMethodRecord = {
  Allocate: 0x0003,
  Refresh: 0x004,
  Send: 0x006,
  Data: 0x007,
  CreatePermission: 0x008,
  ChannelBind: 0x009,
} as const;
export type MsgMethod = keyof typeof msgMethodRecord;
