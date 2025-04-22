import { Client } from "@e5pe0n/turn-ts";
import type { ClientMsg } from "./types.js";

const client = new Client({
  protocol: "udp",
  to: {
    address: "192.168.20.20",
    port: 3478,
  },
  username: "user",
  password: "pass",
  rc: 2,
});

const allocResp = await client.requestAllocate();
console.log("allocResp:", allocResp);
if (allocResp.header.cls !== "successResponse") {
  throw new Error(
    `invalid response; expected successResponse but got ${allocResp.header.cls}`,
  );
}

await client.requestCreatePermission({
  xorPeerAddress: {
    family: "IPv4",
    address: "192.168.20.30",
    port: 50_000,
  },
});

client.onDataIndication((data, rinfo) => {
  console.log("[data indication] data:", data.toString());
  console.log("[data indication] rinfo:", rinfo);
});

const msg: ClientMsg = {
  msg: "hello from client!",
  xorRelayedAddress: allocResp.attrs.xorRelayedAddress!,
};
await client.sendIndication({
  xorPeerAddress: {
    family: "IPv4",
    address: "192.168.20.30",
    port: 50_000,
  },
  data: Buffer.from(JSON.stringify(msg)),
});
console.log("send indication:", msg);
