import { attrTypeRecord as stunAttrTypeRecord } from "@e5pe0n/stun-ts";

// https://datatracker.ietf.org/doc/html/rfc5766#autoid-44
export const attrTypeRecord = {
  ...stunAttrTypeRecord,
  // channelNumber: 0x000c,
  lifetime: 0x000d,
  xorPeerAddress: 0x0012,
  data: 0x0013,
  xorRelayedAddress: 0x0016,
  evenPort: 0x0018,
  requestedTransport: 0x0019,
  dontFragment: 0x001a,
  reservationToken: 0x022,
} as const;
export type AttrType = keyof typeof attrTypeRecord;

export function encodeChannelNumberValue(channelNumber: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt16BE(channelNumber);
  return buf;
}
export function decodeChannelNumberValue(buf: Buffer): number {
  return buf.readUInt16BE();
}

export function encodeLifetimeValue(lifetime: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32BE(lifetime);
  return buf;
}
export function decodeLifetimeValue(buf: Buffer): number {
  return buf.readUInt32BE();
}

export function encodeEvenPortValue(reserveNextHigherPort: boolean): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt8(reserveNextHigherPort ? 0b10000000 : 0);
  return buf;
}
export function decodeEvenPortValue(buf: Buffer): {
  reserveNextHigherPort: boolean;
} {
  return { reserveNextHigherPort: buf[0] === 0b10000000 };
}

// https://datatracker.ietf.org/doc/html/rfc5766#section-14.7
export function encodeRequestedTransportValue(protocol: "udp"): Buffer {
  const buf = Buffer.alloc(4);
  switch (protocol) {
    case "udp":
      buf.writeUInt8(0x11);
      break;
    default:
      protocol satisfies never;
      throw new Error(`invalid protocol: '${protocol}' is not supported.`);
  }
  return buf;
}
export function decodeRequestedTransportValue(buf: Buffer): "udp" {
  const protocol = buf[0]!;
  switch (protocol) {
    case 0x11:
      return "udp";
    default:
      throw new Error(
        `invalid protocol: '0x${protocol.toString(2)}' is not supported.`,
      );
  }
}
