import { describe, expect, it } from "vitest";
import { Client, type successResponse } from "./client.js";
import { Server } from "./server.js";

describe("udp", () => {
  it("receives a binding request then return a success response", async () => {
    const server = new Server({ protocol: "udp" });
    server.listen(12345);
    const client = new Client({
      protocol: "udp",
      to: {
        port: 12345,
        address: "127.0.0.1",
      },
    });

    try {
      const res = await client.request();
      expect(res).toEqual({
        success: true,
        family: "IPv4",
        address: "127.0.0.1",
        port: expect.any(Number),
      } satisfies successResponse);
    } finally {
      server.close();
    }
  });
});

describe("tcp", () => {
  it.only("receives a binding request then return a success response", async () => {
    const server = new Server({ protocol: "tcp" });
    server.listen(12345);
    const client = new Client({
      protocol: "tcp",
      to: {
        port: 12345,
        address: "127.0.0.1",
      },
    });

    try {
      const res = await client.request();
      expect(res).toEqual({
        success: true,
        family: "IPv4",
        address: "127.0.0.1",
        port: expect.any(Number),
      } satisfies successResponse);
    } finally {
      server.close();
    }
  });
});
