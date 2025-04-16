import { type ErrorResult, genPromise, type SuccessResult } from "@e5pe0n/lib";
import type { AddrFamily, Protocol } from "@e5pe0n/stun-ts";
import { createSocket } from "node:dgram";
import { describe, expect, it } from "vitest";
import { type Allocation, Allocator } from "../alloc.js";
import type { MsgType } from "../header.js";
import { type InputAttrs, TurnMsg } from "../msg.js";
import { defaultServerConfig } from "../server.js";
import { handleSend } from "./send.js";

const ctx: {
  trxId: Buffer;
  username: string;
  realm: string;
  password: string;
  nonce: string;
  rinfo: {
    family: AddrFamily;
    address: string;
    port: number;
  };
  serverInfo: {
    transportAddress: { family: AddrFamily; address: string; port: number };
    host: string;
    software: string;
  };
  clientSideSoftware: string;
  transportProtocol: Protocol;
  maxLifetimeSec: number;
} = {
  trxId: Buffer.from([
    0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
  ]),
  username: "user",
  password: "pass",
  realm: "example.com",
  nonce: "nonce",
  rinfo: {
    family: "IPv4",
    port: 51000,
    address: "192.168.200.200",
  },
  serverInfo: {
    transportAddress: {
      family: "IPv4",
      port: defaultServerConfig.port,
      address: "192.168.200.100",
    },
    host: defaultServerConfig.host,
    software: defaultServerConfig.software,
  },
  clientSideSoftware: "@e5pe0n/turn-ts@0.0.0 client",
  transportProtocol: "udp",
  maxLifetimeSec: defaultServerConfig.maxLifetimeSec,
} as const;

describe("handler", () => {
  it.each([
    {
      cls: "indication",
      method: "allocate",
    },
    {
      cls: "request",
      method: "send",
    },
  ] as const)(
    "discards indication if it is not that message class is 'indication' and method is 'send': cls=$cls, method=$method",
    ({ cls, method }: MsgType) => {
      const msg = TurnMsg.build({
        header: {
          cls,
          method,
          trxId: ctx.trxId,
        },
      });
      const allocator = new Allocator({
        maxLifetimeSec: ctx.maxLifetimeSec,
        host: ctx.serverInfo.host,
        serverTransportAddress: ctx.serverInfo.transportAddress,
      });
      const res = handleSend(msg, {
        allocator,
        rinfo: ctx.rinfo,
        transportProtocol: ctx.transportProtocol,
      }) as ErrorResult;
      expect(res.success).toBe(false);
      expect(res.error).toBeInstanceOf(Error);
      expect(res.error.message).toMatch(/Bad Request/);
    },
  );

  it.each([
    {
      testName: "missing XOR-PEER-ADDRESS attr",
      attrs: {
        data: Buffer.alloc(0),
      },
    },
    {
      testName: "missing DATA attr",
      attrs: {
        xorPeerAddress: {
          family: "IPv4",
          address: "127.0.0.1",
          port: 52000,
        },
      },
    },
  ] as const)(
    "discards indication if required attributes are missing or invalid: $testName",
    ({ attrs }: { attrs: InputAttrs }) => {
      const msg = TurnMsg.build({
        header: {
          cls: "indication",
          method: "send",
          trxId: ctx.trxId,
        },
        attrs,
      });
      const allocator = new Allocator({
        maxLifetimeSec: ctx.maxLifetimeSec,
        host: ctx.serverInfo.host,
        serverTransportAddress: ctx.serverInfo.transportAddress,
      });
      const res = handleSend(msg, {
        allocator,
        rinfo: ctx.rinfo,
        transportProtocol: ctx.transportProtocol,
      }) as ErrorResult;
      expect(res.success).toBe(false);
      expect(res.error).toBeInstanceOf(Error);
      expect(res.error.message).toMatch(/Bad Request/);
    },
  );

  it("discards indication if the allocation does not exist", () => {
    const msg = TurnMsg.build({
      header: {
        cls: "indication",
        method: "send",
        trxId: ctx.trxId,
      },
      attrs: {
        xorPeerAddress: {
          family: "IPv4",
          address: "127.0.0.1",
          port: 52000,
        },
        data: Buffer.alloc(0),
      },
    });
    const allocator = new Allocator({
      maxLifetimeSec: ctx.maxLifetimeSec,
      host: ctx.serverInfo.host,
      serverTransportAddress: ctx.serverInfo.transportAddress,
    });
    const res = handleSend(msg, {
      allocator,
      rinfo: ctx.rinfo,
      transportProtocol: ctx.transportProtocol,
    }) as ErrorResult;
    expect(res.success).toBe(false);
    expect(res.error).toBeInstanceOf(Error);
    expect(res.error.message).toMatch(/Allocation Mismatch/);
  });

  it("discards indication if permission does not exists on the allocation", async () => {
    const allocator = new Allocator({
      maxLifetimeSec: ctx.maxLifetimeSec,
      host: ctx.serverInfo.host,
      serverTransportAddress: ctx.serverInfo.transportAddress,
    });
    const allocRes = await allocator.allocate({
      clientTransportAddress: ctx.rinfo,
      transportProtocol: ctx.transportProtocol,
      timeToExpirySec: ctx.maxLifetimeSec,
    });
    expect(allocRes.success).toBe(true);

    const msg = TurnMsg.build({
      header: {
        cls: "indication",
        method: "send",
        trxId: ctx.trxId,
      },
      attrs: {
        xorPeerAddress: {
          family: "IPv4",
          address: "127.0.0.1",
          port: 52000,
        },
        data: Buffer.alloc(0),
      },
    });
    const res = handleSend(msg, {
      allocator,
      rinfo: ctx.rinfo,
      transportProtocol: ctx.transportProtocol,
    }) as ErrorResult;
    expect(res.success).toBe(false);
    expect(res.error).toBeInstanceOf(Error);
    expect(res.error.message).toMatch(/Forbidden/);
  });

  it("sends data to peer", async () => {
    const allocator = new Allocator({
      maxLifetimeSec: ctx.maxLifetimeSec,
      host: ctx.serverInfo.host,
      serverTransportAddress: ctx.serverInfo.transportAddress,
    });
    const allocRes = await allocator.allocate({
      clientTransportAddress: ctx.rinfo,
      transportProtocol: ctx.transportProtocol,
      timeToExpirySec: ctx.maxLifetimeSec,
    });
    expect(allocRes.success).toBe(true);

    allocator.installPermission(
      (allocRes as SuccessResult<Allocation>).value.id,
      {
        family: "IPv4",
        address: "127.0.0.1",
        port: 0,
      },
    );
    const msg = TurnMsg.build({
      header: {
        cls: "indication",
        method: "send",
        trxId: ctx.trxId,
      },
      attrs: {
        xorPeerAddress: {
          family: "IPv4",
          address: "127.0.0.1",
          port: 52000,
        },
        data: Buffer.from([1]),
      },
    });
    const server = createSocket("udp4");
    const gen = genPromise<Buffer>((genResolvers) => {
      server.on("message", (msg, rinfo) => {
        const { resolve } = genResolvers.next().value!;
        resolve(msg);
      });
    });
    server.bind(52000, "127.0.0.1");

    try {
      const res = handleSend(msg, {
        allocator,
        rinfo: ctx.rinfo,
        transportProtocol: ctx.transportProtocol,
      }) as SuccessResult;
      expect(res.success).toBe(true);

      const data = (await gen.next()).value;
      expect(data).toEqual(Buffer.from([1]));
    } finally {
      server.close();
    }
  });
});
