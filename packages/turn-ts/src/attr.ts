import {
  type AttrvDecoders,
  type AttrvEncoders,
  type InputAttr as InputStunAttr,
  type OutputAttr as OutputStunAttr,
  attrTypeRecord as stunAttrTypeRecord,
  attrvDecoders as stunAttrvDecoders,
  attrvEncoders as stunAttrvEncoders,
} from "@e5pe0n/stun-ts";

export const turnAttrTypeRecord = {
  // "CHANNEL-NUMBER": 0x000c,
  LIFETIME: 0x000d,
  // "XOR-PEER-ADDRESS": 0x0012,
  // DATA: 0x0013,
  // "XOR-RELAYED-ADDRESS": 0x0016,
  // "EVEN-PORT": 0x0018,
  "REQUESTED-TRANSPORT": 0x0019,
  "DONT-FRAGMENT": 0x001a,
  // "RESERVATION-TOKEN": 0x0022,
  ...stunAttrTypeRecord,
} as const;
export type TurnAttrType = keyof typeof turnAttrTypeRecord;

export type InputLifetimeAttr = {
  type: "LIFETIME";
  value: number;
};
export type OutputLifetimeAttr = InputLifetimeAttr;

export type InputRequestTransportAttr = {
  type: "REQUESTED-TRANSPORT";
  value: 17;
};
export type OutputRequestTransportAttr = InputRequestTransportAttr;

export type InputDontFragmentAttr = {
  type: "DONT-FRAGMENT";
};
export type OutputDontFragmentAttr = InputDontFragmentAttr & {
  value: undefined;
};

export type InputTurnAttr =
  | InputLifetimeAttr
  | InputRequestTransportAttr
  | InputDontFragmentAttr
  | InputStunAttr;

export type OutputTurnAttr =
  | OutputLifetimeAttr
  | OutputRequestTransportAttr
  | OutputDontFragmentAttr
  | OutputStunAttr;

export const turnAttrvEncoders: AttrvEncoders<InputTurnAttr> = {
  LIFETIME: (attr) => encodeLifetimeAttrv(attr.value),
  "REQUESTED-TRANSPORT": (attr) => encodeRequestTransportAttrv(attr.value),
  "DONT-FRAGMENT": () => Buffer.alloc(0),
  ...stunAttrvEncoders,
};

export const turnAttrvDecoders: AttrvDecoders<OutputTurnAttr> = {
  LIFETIME: decodeLifetimeAttrv,
  "REQUESTED-TRANSPORT": decodeRequestTransportAttrv,
  "DONT-FRAGMENT": () => undefined,
  ...stunAttrvDecoders,
};

export function encodeLifetimeAttrv(value: InputLifetimeAttr["value"]): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(value);
  return buf;
}
export function decodeLifetimeAttrv(buf: Buffer): OutputLifetimeAttr["value"] {
  return buf.readUInt32BE();
}

export function encodeRequestTransportAttrv(
  value: InputRequestTransportAttr["value"],
): Buffer {
  const buf = Buffer.from([value, 0, 0, 0]);
  return buf;
}
export function decodeRequestTransportAttrv(
  buf: Buffer,
): OutputRequestTransportAttr["value"] {
  const protocol = buf[0]!;
  if (protocol !== 17) {
    throw new Error(
      `invalid REQUESTED-TRANSPORT; expected protocol is 17. actual is ${protocol}`,
    );
  }
  return protocol;
}
