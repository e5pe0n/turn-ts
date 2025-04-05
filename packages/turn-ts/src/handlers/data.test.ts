import type { SuccessResult } from "@e5pe0n/lib";
import type { AddrFamily, Protocol } from "@e5pe0n/stun-ts";
import { describe, expect, it, vi } from "vitest";
import { type Allocation, AllocationManager } from "../alloc.js";
import { TurnMsg } from "../msg.js";
import { defaultServerConfig } from "../server.js";
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

describe("handler", () => {
  it("discards data if permission does not exist on the allocation", async () => {
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

    const alloc = (allocRes as SuccessResult<Allocation>).value;
    allocManager.installPermission(alloc.id, {
      family: "IPv4",
      address: "192.0.2.150",
      port: 32102,
    });

    const sender = vi.fn();
    await handleData(Buffer.from([1]), {
      alloc,
      rinfo: {
        family: "IPv4",
        address: "192.0.2.151", // different address than installed permission
        port: 32102,
      },
      sender,
    });
    expect(sender).not.toHaveBeenCalled();
  });

  it("sends data indication by sender", async () => {
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

    const alloc = (allocRes as SuccessResult<Allocation>).value;
    allocManager.installPermission(alloc.id, {
      family: "IPv4",
      address: "192.0.2.150",
      port: 32102,
    });

    const sender = vi.fn();
    await handleData(Buffer.from([1]), {
      alloc,
      rinfo: {
        family: "IPv4",
        address: "192.0.2.150",
        port: 32102,
      },
      sender,
    });
    expect(sender).not.toHaveBeenCalledWith(
      TurnMsg.build({
        header: {
          cls: "indication",
          method: "data",
          trxId: expect.any(Buffer),
        },
        attrs: {
          xorPeerAddress: {
            family: "IPv4",
            address: "192.0.2.150",
            port: 0,
          },
          data: Buffer.alloc(1),
        },
      }),
    );
  });
});
