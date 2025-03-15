import { Server } from "@e5pe0n/stun-ts";

{
  const server = new Server({
    protocol: "udp",
  });
  server.listen(3478, "0.0.0.0");
}
{
  const server = new Server({
    protocol: "tcp",
  });
  server.listen(3479, "0.0.0.0");
}
