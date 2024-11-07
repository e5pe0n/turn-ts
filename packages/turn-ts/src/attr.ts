export const attrTypeRecord = {
  "CHANNEL-NUMBER": 0x000c,
  LIFETIME: 0x000d,
  "XOR-PEER-ADDRESS": 0x0012,
  DATA: 0x0013,
  "XOR-RELAYED-ADDRESS": 0x0016,
  "EVEN-PORT": 0x0018,
  "REQUESTED-TRANSPORT": 0x0019,
  "DONT-FRAGMENT": 0x001a,
  "RESERVATION-TOKEN": 0x0022,
} as const;
type AttrType = keyof typeof attrTypeRecord;
