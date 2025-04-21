import { Server } from "@e5pe0n/turn-ts";

{
  const server = new Server({
    host: "0.0.0.0",
    serverAddress: "192.168.20.20",
    username: "user",
    password: "pass",
    realm: "example.com",
    // TODO: nonce should be generated randomly regularly
    nonce: "nonce",
    software: "@e5pe0n/turn-ts@0.0.0 server",
  });
  server.listen();
}
