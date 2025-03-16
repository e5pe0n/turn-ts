import { describe, test, expect } from "vitest";
import { Client, magicCookie } from "@e5pe0n/stun-ts";

describe("binding request", () => {
  test("udp", async () => {
    const client = new Client({
      protocol: "udp",
      to: {
        address: "74.125.250.129", // stun.l.google.com
        port: 19302,
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
          port: expect.any(Number),
          address: expect.any(String),
        },
      },
      raw: expect.any(Buffer),
    });
  });
  test.todo("tcp", async () => {
    const client = new Client({
      protocol: "tcp",
      to: {
        address: "74.125.250.129", // stun.l.google.com does not support tcp
        port: 19302,
      },
      from: {
        port: 54332,
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
          port: expect.any(Number),
          address: expect.any(String),
        },
      },
      raw: expect.any(Buffer),
    });
  });
});
