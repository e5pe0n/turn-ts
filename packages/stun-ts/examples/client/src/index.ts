import { createClient } from "stun-ts";

{
  const client = createClient({
    address: "74.125.250.129", // stun.l.google.com
    port: 19302,
    protocol: "udp",
  });
  const res = await client.send("request", "binding");
  // biome-ignore lint/suspicious/noConsole: example code
  console.log(res);
}
