import { genPromise } from "@e5pe0n/lib";
import { createSocket } from "node:dgram";
import { createConnection } from "node:net";
import { setTimeout } from "node:timers/promises";
import { describe, expect, it } from "vitest";
import { magicCookie } from "./common.js";
import { StunMsg } from "./msg.js";
import { Server } from "./server.js";

describe("udp", () => {
  it("receives binding requests then return success responses", async () => {
    // Arrange
    const server = new Server({ protocol: "udp" });
    const sock = createSocket("udp4");
    const gen = genPromise<Buffer>((genResolvers) => {
      sock.on("message", (msg) => {
        const { resolve } = genResolvers.next().value!;
        resolve(msg);
      });
    });
    sock.bind(54321);
    server.listen(12345);

    try {
      {
        const req = StunMsg.build({
          header: {
            cls: "request",
            method: "binding",
            trxId: Buffer.alloc(12),
          },
        });

        // Act & Assert
        sock.send(req.raw, 12345, "127.0.0.1");
        const respBuf = (await gen.next()).value!;
        const res = StunMsg.from(respBuf);
        expect(res).toEqual({
          header: {
            cls: "successResponse",
            method: "binding",
            trxId: req.header.trxId,
            length: 12,
            magicCookie,
          },
          attrs: {
            xorMappedAddress: {
              family: "IPv4",
              port: 54321,
              address: "127.0.0.1",
            },
          },
          raw: expect.any(Buffer),
        } satisfies StunMsg);
      }
      {
        const req = StunMsg.build({
          header: {
            cls: "request",
            method: "binding",
            trxId: Buffer.alloc(12),
          },
        });

        // Act & Assert
        sock.send(req.raw, 12345, "127.0.0.1");
        const respBuf = (await gen.next()).value!;
        const resp = StunMsg.from(respBuf);
        expect(resp).toEqual({
          header: {
            cls: "successResponse",
            method: "binding",
            trxId: req.header.trxId,
            length: 12,
            magicCookie,
          },
          attrs: {
            xorMappedAddress: {
              family: "IPv4",
              port: 54321,
              address: "127.0.0.1",
            },
          },
          raw: expect.any(Buffer),
        } satisfies StunMsg);
      }
    } finally {
      server.close();
    }
  });
});

describe("tcp", () => {
  it("receives binding requests then return success responses", async () => {
    // Arrange
    const server = new Server({ protocol: "tcp" });
    const req1 = StunMsg.build({
      header: {
        cls: "request",
        method: "binding",
        trxId: Buffer.alloc(12),
      },
    });
    const req2 = StunMsg.build({
      header: {
        cls: "request",
        method: "binding",
        trxId: Buffer.alloc(12),
      },
    });
    server.listen(12345, "127.0.0.1");

    //  Act
    const sock = createConnection(
      {
        port: 12345,
        host: "127.0.0.1",
        localAddress: "127.0.0.1",
        localPort: 54321,
      },
      async () => {
        sock.write(req1.raw);
        await setTimeout(10); // wait for the server to process the first request
        sock.write(req2.raw);
        sock.end();
      },
    );

    try {
      const gen = genPromise<Buffer>((genResolvers) => {
        sock.on("data", (data) => {
          const { resolve } = genResolvers.next().value!;
          resolve(data);
        });
      });
      {
        const respBuf = (await gen.next()).value!;
        const resp = StunMsg.from(respBuf);
        expect(resp).toEqual({
          header: {
            cls: "successResponse",
            method: "binding",
            trxId: req1.header.trxId,
            length: 12,
            magicCookie,
          },
          attrs: {
            xorMappedAddress: {
              family: "IPv4",
              port: 54321,
              address: "127.0.0.1",
            },
          },
          raw: expect.any(Buffer),
        } satisfies StunMsg);
      }
      {
        const respBuf = (await gen.next()).value!;
        const resp = StunMsg.from(respBuf);
        expect(resp).toEqual({
          header: {
            cls: "successResponse",
            method: "binding",
            trxId: req2.header.trxId,
            length: 12,
            magicCookie,
          },
          attrs: {
            xorMappedAddress: {
              family: "IPv4",
              port: 54321,
              address: "127.0.0.1",
            },
          },
          raw: expect.any(Buffer),
        } satisfies StunMsg);
      }
    } finally {
      sock.destroy();
      server.close();
    }
  });
});
