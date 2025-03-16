import { describe, test, expect } from "vitest";
import { Client, magicCookie } from "@e5pe0n/stun-ts";

describe("binding request", () => {
  test("udp", async () => {
    const client = new Client({
      protocol: "udp",
      to: {
        address: "192.168.200.100", // public ip of stun server
        port: 3478,
      },
      from: {
        port: 50000,
      },
    });
    const resp = await client.request();
    expect(resp).toEqual({
      header: {
        cls: "successResponse",
        method: "binding",
        trxId: expect.any(Buffer),
        length: 12,
        magicCookie,
      },
      attrs: {
        xorMappedAddress: {
          family: "IPv4",
          port: 50000,
          address: "192.168.200.200", // public ip of router
        },
      },
      raw: expect.any(Buffer),
    });
  });
  test("tcp", async () => {
    const client = new Client({
      protocol: "tcp",
      to: {
        address: "192.168.200.100", // public ip of stun server
        port: 3479,
      },
      from: {
        port: 50001,
      },
    });
    const resp = await client.request();
    expect(resp).toEqual({
      header: {
        cls: "successResponse",
        method: "binding",
        trxId: expect.any(Buffer),
        length: 12,
        magicCookie,
      },
      attrs: {
        xorMappedAddress: {
          family: "IPv4",
          port: 50001,
          address: "192.168.200.200", // public ip of router
        },
      },
      raw: expect.any(Buffer),
    });
  });
});
