import { type AddrFamily, type Protocol, magicCookie } from "@e5pe0n/stun-ts";
import { describe, expect, it } from "vitest";
import { Allocator } from "../alloc.js";
import type { MsgType } from "../header.js";
import { TurnMsg } from "../msg.js";
import { defaultServerConfig } from "../server.js";
import { handleAllocate } from "./alloc.js";
import { handleData } from "./data.js";

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

describe("req handler", () => {
  it.each([
    {
      cls: "indication",
      method: "allocate",
    },
    {
      cls: "request",
      method: "binding",
    },
  ] as const)(
    "returns 400 error response if it is not that message class is 'request' and method is 'allocate': cls=$cls, method=$method",
    async ({ cls, method }: MsgType) => {
      const req = TurnMsg.build({
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
      const resp = await handleAllocate(req, {
        allocator,
        rinfo: ctx.rinfo,
        transportProtocol: ctx.transportProtocol,
        serverInfo: ctx.serverInfo,
      });
      expect(resp).toEqual({
        header: {
          cls: "errorResponse",
          method: req.header.method,
          trxId: req.header.trxId,
          length: expect.any(Number),
          magicCookie,
        },
        attrs: {
          errorCode: { code: 400, reason: "Bad Request" },
        },
        raw: expect.any(Buffer),
        msgIntegrityOffset: expect.any(Number),
      } satisfies TurnMsg);
    },
  );

  it("returns 400 error response if requestedTransport is in the request", async () => {
    const req = TurnMsg.build({
      header: {
        cls: "request",
        method: "allocate",
        trxId: ctx.trxId,
      },
    });
    const allocator = new Allocator({
      maxLifetimeSec: ctx.maxLifetimeSec,
      host: ctx.serverInfo.host,
      serverTransportAddress: ctx.serverInfo.transportAddress,
    });
    const resp = await handleAllocate(req, {
      allocator,
      rinfo: ctx.rinfo,
      transportProtocol: ctx.transportProtocol,
      serverInfo: ctx.serverInfo,
    });
    expect(resp).toEqual({
      header: {
        cls: "errorResponse",
        method: req.header.method,
        trxId: req.header.trxId,
        length: expect.any(Number),
        magicCookie,
      },
      attrs: {
        errorCode: { code: 400, reason: "Bad Request" },
      },
      raw: expect.any(Buffer),
      msgIntegrityOffset: expect.any(Number),
    } satisfies TurnMsg);
  });

  it.todo(
    "returns 442 error response if requestedTransport is not 'udp'",
    async () => {
      const req = TurnMsg.build({
        header: {
          cls: "request",
          method: "allocate",
          trxId: ctx.trxId,
        },
        attrs: {
          // @ts-expect-error
          requestedTransport: "tcp",
        },
      });
      const allocator = new Allocator({
        maxLifetimeSec: ctx.maxLifetimeSec,
        host: ctx.serverInfo.host,
        serverTransportAddress: ctx.serverInfo.transportAddress,
      });
      const resp = await handleAllocate(req, {
        allocator,
        rinfo: ctx.rinfo,
        transportProtocol: ctx.transportProtocol,
        serverInfo: ctx.serverInfo,
      });
      expect(resp).toEqual({
        header: {
          cls: "errorResponse",
          method: req.header.method,
          trxId: req.header.trxId,
          length: expect.any(Number),
          magicCookie,
        },
        attrs: {
          errorCode: { code: 442, reason: "Unsupported Transport Protocol" },
        },
        raw: expect.any(Buffer),
        msgIntegrityOffset: expect.any(Number),
      } satisfies TurnMsg);
    },
  );

  it("returns 437 error response if allocation is already used", async () => {
    const allocator = new Allocator({
      maxLifetimeSec: ctx.maxLifetimeSec,
      host: ctx.serverInfo.host,
      serverTransportAddress: ctx.serverInfo.transportAddress,
    });
    const allocRes = await allocator.allocate(
      {
        clientTransportAddress: ctx.rinfo,
        transportProtocol: ctx.transportProtocol,
        timeToExpirySec: ctx.maxLifetimeSec,
      },
      handleData,
    );
    expect(allocRes.success).toBe(true);

    const req = TurnMsg.build({
      header: {
        cls: "request",
        method: "allocate",
        trxId: ctx.trxId,
      },
      attrs: {
        requestedTransport: "udp",
      },
    });
    const resp = await handleAllocate(req, {
      allocator,
      rinfo: ctx.rinfo,
      transportProtocol: ctx.transportProtocol,
      serverInfo: ctx.serverInfo,
    });
    expect(resp).toEqual({
      header: {
        cls: "errorResponse",
        method: req.header.method,
        trxId: req.header.trxId,
        length: expect.any(Number),
        magicCookie,
      },
      attrs: {
        errorCode: { code: 437, reason: "Allocation Mismatch" },
      },
      raw: expect.any(Buffer),
      msgIntegrityOffset: expect.any(Number),
    } satisfies TurnMsg);
  });

  it("returns success response if it created a new allocation", async () => {
    const allocator = new Allocator({
      maxLifetimeSec: ctx.maxLifetimeSec,
      host: ctx.serverInfo.host,
      serverTransportAddress: ctx.serverInfo.transportAddress,
    });

    const req = TurnMsg.build({
      header: {
        cls: "request",
        method: "allocate",
        trxId: ctx.trxId,
      },
      attrs: {
        requestedTransport: "udp",
        lifetime: 1200,
      },
    });
    const resp = await handleAllocate(req, {
      allocator,
      rinfo: ctx.rinfo,
      transportProtocol: ctx.transportProtocol,
      serverInfo: ctx.serverInfo,
    });
    expect(resp).toEqual({
      header: {
        cls: "successResponse",
        method: req.header.method,
        trxId: req.header.trxId,
        length: expect.any(Number),
        magicCookie,
      },
      attrs: {
        lifetime: 1200,
        software: ctx.serverInfo.software,
        xorMappedAddress: {
          family: "IPv4",
          address: ctx.rinfo.address,
          port: ctx.rinfo.port,
        },
        xorRelayedAddress: {
          family: "IPv4",
          address: ctx.serverInfo.transportAddress.address,
          port: expect.any(Number),
        },
      },
      raw: expect.any(Buffer),
      msgIntegrityOffset: expect.any(Number),
    } satisfies TurnMsg);
  });
});
