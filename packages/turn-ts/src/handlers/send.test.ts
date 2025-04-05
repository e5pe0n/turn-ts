import type { SuccessResult } from "@e5pe0n/lib";
import type { AddrFamily, Protocol } from "@e5pe0n/stun-ts";
import { describe, expect, it, vi } from "vitest";
import { type Allocation, AllocationManager } from "../alloc.js";
import type { MsgType } from "../header.js";
import { type InputAttrs, TurnMsg } from "../msg.js";
import { defaultServerConfig } from "../server.js";
import { handleData } from "./data.js";
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
    async ({ cls, method }: MsgType) => {
      const msg = TurnMsg.build({
        header: {
          cls,
          method,
          trxId: ctx.trxId,
        },
      });
      const allocManager = new AllocationManager({
        maxLifetimeSec: ctx.maxLifetimeSec,
        host: ctx.serverInfo.host,
        serverTransportAddress: ctx.serverInfo.transportAddress,
      });
      const sender = vi.fn();
      await handleSend(msg, {
        allocManager: allocManager,
        rinfo: ctx.rinfo,
        transportProtocol: ctx.transportProtocol,
        sender,
      });
      expect(sender).not.toHaveBeenCalled();
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
          address: "192.0.2.150",
          port: 32102,
        },
      },
    },
  ] as const)(
    "discards indication if required attributes are missing or invalid: $testName",
    async ({ attrs }: { attrs: InputAttrs }) => {
      const allocManager = new AllocationManager({
        maxLifetimeSec: ctx.maxLifetimeSec,
        host: ctx.serverInfo.host,
        serverTransportAddress: ctx.serverInfo.transportAddress,
      });

      const msg = TurnMsg.build({
        header: {
          cls: "request",
          method: "createPermission",
          trxId: ctx.trxId,
        },
        attrs,
      });
      const sender = vi.fn();
      await handleSend(msg, {
        allocManager,
        rinfo: ctx.rinfo,
        transportProtocol: ctx.transportProtocol,
        sender,
      });
      expect(sender).not.toHaveBeenCalled();
    },
  );

  it("discards indication if the allocation does not exist", async () => {
    const allocManager = new AllocationManager({
      maxLifetimeSec: ctx.maxLifetimeSec,
      host: ctx.serverInfo.host,
      serverTransportAddress: ctx.serverInfo.transportAddress,
    });

    const msg = TurnMsg.build({
      header: {
        cls: "indication",
        method: "send",
        trxId: ctx.trxId,
      },
      attrs: {
        xorPeerAddress: {
          family: "IPv4",
          address: "192.0.2.150",
          port: 32102,
        },
        data: Buffer.alloc(0),
      },
    });
    const sender = vi.fn();
    await handleSend(msg, {
      allocManager,
      rinfo: ctx.rinfo,
      transportProtocol: ctx.transportProtocol,
      sender,
    });
    expect(sender).not.toHaveBeenCalled();
  });

  it("discards indication if no permission exists on the allocation", async () => {
    const allocManager = new AllocationManager({
      maxLifetimeSec: ctx.maxLifetimeSec,
      host: ctx.serverInfo.host,
      serverTransportAddress: ctx.serverInfo.transportAddress,
    });
    const allocRes = await allocManager.allocate(
      {
        clientTransportAddress: ctx.rinfo,
        transportProtocol: ctx.transportProtocol,
        timeToExpirySec: ctx.maxLifetimeSec,
      },
      handleData,
    );
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
          address: "192.0.2.150",
          port: 32102,
        },
        data: Buffer.alloc(0),
      },
    });
    const sender = vi.fn();
    await handleSend(msg, {
      allocManager,
      rinfo: ctx.rinfo,
      transportProtocol: ctx.transportProtocol,
      sender,
    });
    expect(sender).not.toHaveBeenCalled();
  });

  it("sends data by sender", async () => {
    const allocManager = new AllocationManager({
      maxLifetimeSec: ctx.maxLifetimeSec,
      host: ctx.serverInfo.host,
      serverTransportAddress: ctx.serverInfo.transportAddress,
    });
    const allocRes = await allocManager.allocate(
      {
        clientTransportAddress: ctx.rinfo,
        transportProtocol: ctx.transportProtocol,
        timeToExpirySec: ctx.maxLifetimeSec,
      },
      handleData,
    );
    expect(allocRes.success).toBe(true);

    allocManager.installPermission(
      (allocRes as SuccessResult<Allocation>).value.id,
      {
        family: "IPv4",
        address: "192.0.2.150",
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
          address: "192.0.2.150",
          port: 32102,
        },
        data: Buffer.alloc(0),
      },
    });
    const sender = vi.fn();
    await handleSend(msg, {
      allocManager,
      rinfo: ctx.rinfo,
      transportProtocol: ctx.transportProtocol,
      sender,
    });
    expect(sender).toHaveBeenCalled();
  });
});
