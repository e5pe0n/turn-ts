import { genPromise, type ErrorResult, type SuccessResult } from "@e5pe0n/lib";
import { magicCookie, type AddrFamily, type Protocol } from "@e5pe0n/stun-ts";
import { createSocket } from "node:dgram";
import { describe, expect, it } from "vitest";
import { Allocator, type Allocation } from "../alloc.js";
import { defaultServerConfig } from "../server.js";
import { handleData } from "./data.js";
import { TurnMsg } from "../msg.js";

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
    port: 50000,
    address: "127.0.0.1",
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
  it("discards data if permission does not exist on the allocation", async () => {
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

    const alloc = (allocRes as SuccessResult<Allocation>).value;
    allocator.installPermission(alloc.id, {
      ...ctx.rinfo,
      port: 0,
    });

    const res = handleData(Buffer.from([1]), {
      alloc,
      rinfo: {
        family: "IPv4",
        address: "192.0.2.150", // different address than installed permission
        port: 0,
      },
    }) as ErrorResult;
    expect(res.success).toBe(false);
    expect(res.error).toBeInstanceOf(Error);
    expect(res.error.message).toMatch(/Forbidden/);
  });

  it("sends data indication", async () => {
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

    const alloc = (allocRes as SuccessResult<Allocation>).value;
    allocator.installPermission(alloc.id, {
      ...ctx.rinfo,
      port: 0,
    });
    const turnClient = createSocket("udp4");
    const gen = genPromise<Buffer>((genResolvers) => {
      turnClient.on("message", (msg, rinfo) => {
        const { resolve } = genResolvers.next().value!;
        resolve(msg);
      });
    });
    turnClient.bind(ctx.rinfo.port, ctx.rinfo.address);

    try {
      const res = handleData(Buffer.from([1]), {
        alloc,
        rinfo: {
          family: "IPv4",
          address: "127.0.0.1",
          port: 52000,
        },
      }) as SuccessResult<undefined>;
      expect(res.success).toBe(true);

      const data = (await gen.next()).value!;
      const msg = TurnMsg.from(data);
      expect(msg).toEqual({
        header: {
          cls: "indication",
          method: "data",
          trxId: expect.any(Buffer),
          length: expect.any(Number),
          magicCookie,
        },
        attrs: {
          xorPeerAddress: {
            family: "IPv4",
            address: "127.0.0.1",
            port: 52000,
          },
          data: Buffer.from([1, 0, 0, 0]),
        },
        raw: expect.any(Buffer),
        msgIntegrityOffset: expect.any(Number),
      } satisfies TurnMsg);
    } finally {
      turnClient.close();
    }
  });
});
