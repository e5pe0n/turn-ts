import { createSocket } from "node:dgram";
import { genPromise } from "@e5pe0n/lib/src/index.js";
import { magicCookie } from "@e5pe0n/stun-ts";
import { describe, expect, it } from "vitest";
import { Client } from "./client.js";
import { TurnMsg } from "./msg.js";

describe("request", () => {
  describe("Allocate", () => {
    it("sends an Allocate request then receives a success response", async () => {
      const server = createSocket("udp4");
      const gen = genPromise<Buffer>((genResolvers) => {
        server.on("message", (msg, rinfo) => {
          const { resolve } = genResolvers.next().value!;
          const req = TurnMsg.from(msg);
          resolve(req.raw);
          let resp: TurnMsg;
          if (!req.attrs.messageIntegrity) {
            resp = TurnMsg.build({
              header: {
                cls: "errorResponse",
                method: "allocate",
                trxId: req.header.trxId,
              },
              attrs: {
                software: "@e5pe0n/turn-ts@0.0.0 server",
                errorCode: { code: 401, reason: "Unauthorized" },
                realm: "example.com",
                nonce: "nonce",
              },
            });
          } else {
            resp = TurnMsg.build({
              header: {
                cls: "successResponse",
                method: "allocate",
                trxId: req.header.trxId,
              },
              attrs: {
                software: "@e5pe0n/turn-ts@0.0.0 server",
                lifetime: 1200,
                xorRelayedAddress: {
                  family: "IPv4",
                  address: "192.0.2.15",
                  port: 50000,
                },
                xorMappedAddress: {
                  family: "IPv4",
                  address: "192.0.2.1",
                  port: 7000,
                },
                messageIntegrity: req.attrs.messageIntegrity,
              },
            });
          }
          server.send(resp.raw, rinfo.port, rinfo.address);
        });
      });
      server.bind(3478, "127.0.0.1");

      const client = new Client({
        protocol: "udp",
        to: {
          address: "127.0.0.1",
          port: 3478,
        },
        username: "user",
        realm: "example.com",
        password: "pass",
      });
      try {
        const resp = await client.requestAllocate("allocate");
        const reqBuf1 = (await gen.next()).value!;
        const reqBuf2 = (await gen.next()).value!;

        const req1 = TurnMsg.from(reqBuf1);
        expect(req1).toEqual({
          header: {
            cls: "request",
            method: "allocate",
            trxId: expect.any(Buffer),
            length: expect.any(Number),
            magicCookie,
          },
          attrs: {
            software: "@e5pe0n/turn-ts@0.0.0 client",
            lifetime: 3600,
            requestedTransport: "udp",
            dontFragment: true,
          },
          raw: expect.any(Buffer),
          msgIntegrityOffset: expect.any(Number),
        } satisfies TurnMsg);
        const req2 = TurnMsg.from(reqBuf2);
        expect(req2).toEqual({
          header: {
            cls: "request",
            method: "allocate",
            trxId: expect.any(Buffer),
            length: expect.any(Number),
            magicCookie,
          },
          attrs: {
            software: "@e5pe0n/turn-ts@0.0.0 client",
            lifetime: 3600,
            requestedTransport: "udp",
            dontFragment: true,
            username: "user",
            realm: "example.com",
            nonce: "nonce",
            messageIntegrity: expect.any(Buffer),
          },
          raw: expect.any(Buffer),
          msgIntegrityOffset: expect.any(Number),
        } satisfies TurnMsg);
        expect(resp).toEqual({
          header: {
            cls: "successResponse",
            method: "allocate",
            trxId: expect.any(Buffer),
            length: expect.any(Number),
            magicCookie,
          },
          attrs: {
            software: "@e5pe0n/turn-ts@0.0.0 server",
            lifetime: 1200,
            xorRelayedAddress: {
              family: "IPv4",
              address: "192.0.2.15",
              port: 50000,
            },
            xorMappedAddress: {
              family: "IPv4",
              address: "192.0.2.1",
              port: 7000,
            },
            messageIntegrity: req2.attrs.messageIntegrity,
          },
          raw: expect.any(Buffer),
          msgIntegrityOffset: expect.any(Number),
        } satisfies TurnMsg);
      } finally {
        server.close();
        client.close();
      }
    });
  });
});
