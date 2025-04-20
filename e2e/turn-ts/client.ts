import { Client } from "@e5pe0n/turn-ts";

const client = new Client({
  protocol: "udp",
  to: {
    address: "127.0.0.1",
    port: 3478,
  },
  username: "user",
  password: "pass",
});

await client.requestAllocate();
