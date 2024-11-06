import { Client } from "stun-ts";

{
  const client = new Client({
    protocol: "udp",
    dest: {
      address: "74.125.250.129", // stun.l.google.com
      port: 19302,
    },
  });
  const res = await client.request();
  // biome-ignore lint/suspicious/noConsole: example code
  console.log(res);
}
