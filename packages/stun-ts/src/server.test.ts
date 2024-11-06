import { expect, it } from "vitest";
import { Client, type SuccessResponse } from "./client.js";
import { Server } from "./server.js";

it("receives a request then return a response", async () => {
  const server = new Server({ protocol: "udp" });
  server.listen(12345);
  const client = new Client({
    protocol: "udp",
    dest: {
      port: 12345,
      address: "127.0.0.1",
    },
  });
  const res = await client.request();
  expect(res).toEqual({
    success: true,
    family: "IPv4",
    address: "127.0.0.1",
    port: expect.any(Number),
  } satisfies SuccessResponse);
  server.close();
});
