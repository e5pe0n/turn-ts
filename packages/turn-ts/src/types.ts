export type FiveTuple = {
  srcAddr: string;
  srcPort: number;
  dstAddr: string;
  dstPort: number;
  protocol: "udp" | "tcp";
};
