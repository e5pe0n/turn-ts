import { expect, it } from "vitest";
import { type SuccessResponse, createClient } from "./client.js";
import { Server } from "./server.js";

it("receives a request then return a response", async () => {
  const server = new Server({ protocol: "udp" });
  server.listen(12345);
  const client = createClient({
    port: 12345,
    address: "127.0.0.1",
    protocol: "udp",
  });
  const res = await client.send("Request", "Binding");
  expect(res).toEqual({
    success: true,
    address: "127.0.0.1",
    port: expect.any(Number),
  } satisfies SuccessResponse);
  server.close();
});
