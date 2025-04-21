import { createSocket } from "node:dgram";
import type { ClientMsg } from "./types.js";

const sock = createSocket("udp4");
sock.bind(50_000, "0.0.0.0");
sock.on("message", (msg, rinfo) => {
  console.log("message", msg.toString());
  console.log("subarray", msg.subarray(-4));
  console.log("rinfo", rinfo);
  const data = JSON.parse(msg.subarray(0, -3).toString()) as ClientMsg;
  console.log("data", data);
  sock.send(
    "hello from peer!",
    data.xorRelayedAddress.port,
    data.xorRelayedAddress.address,
  );
});
