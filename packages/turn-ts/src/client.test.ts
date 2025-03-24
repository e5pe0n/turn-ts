import { createSocket } from "node:dgram";
import { genPromise, withResolvers } from "@e5pe0n/lib/src/index.js";
import { type RawStunFmtMsg, magicCookie } from "@e5pe0n/stun-ts";
import { readTrxId } from "@e5pe0n/stun-ts/src/header.js";
import { describe, expect, it } from "vitest";
import {
  type AllocateErrorResponse,
  type AllocateSuccessResponse,
  Client,
} from "./client.js";
import { TurnMsg, decodeTurnMsg, encodeTurnMsg } from "./msg.js";

describe("request", () => {
  describe("Allocate", () => {
    it("sends an Allocate request then receives a success response", async () => {
      const server = createSocket("udp4");
      const gen = genPromise<Buffer>((genResolvers) => {
        server.on("message", (msg, rinfo) => {
          const { resolve } = genResolvers.next().value!;
          const req = TurnMsg.from(msg);
          if (!req.attrs.messageIntegrity) {
            const resp = TurnMsg.build({
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
            const resp = TurnMsg.build({
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
                messageIntegrity: {},
              },
            });
          }
        });
      });

      const { promise: p1, resolve: r1 } = withResolvers<Buffer>();
      const { promise: p2, resolve: r2 } = withResolvers<Buffer>();
      let cnt = 0;
      server.on("message", async (msg, rinfo) => {
        if (cnt === 0) {
          r1(msg);
          const res1 = encodeTurnMsg({
            header: {
              cls: "request",
              method: "Allocate",
              trxId: readTrxId(msg as RawStunFmtMsg),
            },
            attrs: [
              {
                type: "SOFTWARE",
                value: "@e5pe0n/turn-ts@0.0.1 server",
              },
              {
                type: "ERROR-CODE",
                value: {
                  code: 401,
                  reason: "Unauthorized",
                },
              },
              {
                type: "REALM",
                value: "example.com",
              },
              {
                type: "NONCE",
                value: "nonce",
              },
            ],
          });
          server.send(res1, rinfo.port, rinfo.address);
          ++cnt;
        } else {
          r2(msg);
          const res2 = encodeTurnMsg({
            header: {
              cls: "successResponse",
              method: "Allocate",
              trxId: readTrxId(msg as RawStunFmtMsg),
            },
            attrs: [
              {
                type: "SOFTWARE",
                value: "@e5pe0n/turn-ts@0.0.1 server",
              },
              {
                type: "LIFETIME",
                value: 1200,
              },
              {
                type: "XOR-RELAYED-ADDRESS",
                value: {
                  family: "IPv4",
                  address: "192.0.2.15",
                  port: 50000,
                },
              },
              {
                type: "XOR-MAPPED-ADDRESS",
                value: {
                  family: "IPv4",
                  address: "192.0.2.1",
                  port: 7000,
                },
              },
              {
                type: "MESSAGE-INTEGRITY",
                params: {
                  term: "long",
                  username: "user",
                  realm: "example.com",
                  password: "pass",
                },
              },
            ],
          });
          server.send(res2, rinfo.port, rinfo.address);
        }
      });
      server.bind(3478, "127.0.0.1");

      const client = new Client({
        dest: {
          address: "127.0.0.1",
          port: 3478,
        },
        username: "user",
        realm: "example.com",
        password: "pass",
      });
      try {
        const res = client.request("Allocate");
        const req1 = await p1;
        expect(decodeTurnMsg(req1 as RawStunFmtMsg)).toEqual({
          header: {
            cls: "request",
            method: "Allocate",
            trxId: expect.any(Buffer),
            length: expect.any(Number),
            magicCookie,
          },
          attrs: [
            {
              type: "SOFTWARE",
              value: "@e5pe0n/turn-ts@0.0.1 client",
            },
            {
              type: "LIFETIME",
              value: 3600,
            },
            {
              type: "REQUESTED-TRANSPORT",
              value: 17,
            },
            {
              type: "DONT-FRAGMENT",
              value: undefined,
            },
          ],
        } satisfies TurnMsg);
        const req2 = await p2;
        expect(decodeTurnMsg(req2 as RawStunFmtMsg)).toEqual({
          header: {
            cls: "request",
            method: "Allocate",
            trxId: expect.any(Buffer),
            length: expect.any(Number),
            magicCookie,
          },
          attrs: [
            {
              type: "SOFTWARE",
              value: "@e5pe0n/turn-ts@0.0.1 client",
            },
            {
              type: "LIFETIME",
              value: 3600,
            },
            {
              type: "REQUESTED-TRANSPORT",
              value: 17,
            },
            {
              type: "DONT-FRAGMENT",
              value: undefined,
            },
            {
              type: "USERNAME",
              value: "user",
            },
            {
              type: "REALM",
              value: "example.com",
            },
            {
              type: "NONCE",
              value: "nonce",
            },
            {
              type: "MESSAGE-INTEGRITY",
              value: expect.any(Buffer),
            },
          ],
        } satisfies TurnMsg);
        await expect(res).resolves.toEqual({
          success: true,
          relayedAddress: {
            family: "IPv4",
            address: "192.0.2.15",
            port: 50000,
          },
          mappedAddress: {
            family: "IPv4",
            address: "192.0.2.1",
            port: 7000,
          },
          lifetime: 1200,
        } satisfies AllocateSuccessResponse);
      } finally {
        server.close();
        client.close();
      }
    });
    it("sends Allocate request then receives error response", async () => {
      const server = createSocket("udp4");

      const { promise: p1, resolve: r1 } = withResolvers<Buffer>();
      const { promise: p2, resolve: r2 } = withResolvers<Buffer>();
      let cnt = 0;
      server.on("message", async (msg, rinfo) => {
        if (cnt === 0) {
          r1(msg);
          const res1 = encodeTurnMsg({
            header: {
              cls: "request",
              method: "Allocate",
              trxId: readTrxId(msg as RawStunFmtMsg),
            },
            attrs: [
              {
                type: "SOFTWARE",
                value: "@e5pe0n/turn-ts@0.0.1 server",
              },
              {
                type: "ERROR-CODE",
                value: {
                  code: 401,
                  reason: "Unauthorized",
                },
              },
              {
                type: "REALM",
                value: "example.com",
              },
              {
                type: "NONCE",
                value: "nonce",
              },
            ],
          });
          server.send(res1, rinfo.port, rinfo.address);
          ++cnt;
        } else {
          r2(msg);
          const res2 = encodeTurnMsg({
            header: {
              cls: "errorResponse",
              method: "Allocate",
              trxId: readTrxId(msg as RawStunFmtMsg),
            },
            attrs: [
              {
                type: "SOFTWARE",
                value: "@e5pe0n/turn-ts@0.0.1 server",
              },
              {
                type: "ERROR-CODE",
                value: {
                  code: 401,
                  reason: "Unauthorized",
                },
              },
              {
                type: "MESSAGE-INTEGRITY",
                params: {
                  term: "long",
                  username: "user",
                  realm: "example.com",
                  password: "pass",
                },
              },
            ],
          });
          server.send(res2, rinfo.port, rinfo.address);
        }
      });
      server.bind(3478, "127.0.0.1");

      const client = new Client({
        dest: {
          address: "127.0.0.1",
          port: 3478,
        },
        username: "user",
        realm: "example.com",
        password: "pass",
      });
      try {
        const res = client.request("Allocate");
        const req1 = await p1;
        expect(decodeTurnMsg(req1 as RawStunFmtMsg)).toEqual({
          header: {
            cls: "request",
            method: "Allocate",
            trxId: expect.any(Buffer),
            length: expect.any(Number),
            magicCookie,
          },
          attrs: [
            {
              type: "SOFTWARE",
              value: "@e5pe0n/turn-ts@0.0.1 client",
            },
            {
              type: "LIFETIME",
              value: 3600,
            },
            {
              type: "REQUESTED-TRANSPORT",
              value: 17,
            },
            {
              type: "DONT-FRAGMENT",
              value: undefined,
            },
          ],
        } satisfies TurnMsg);
        const req2 = await p2;
        expect(decodeTurnMsg(req2 as RawStunFmtMsg)).toEqual({
          header: {
            cls: "request",
            method: "Allocate",
            trxId: expect.any(Buffer),
            length: expect.any(Number),
            magicCookie,
          },
          attrs: [
            {
              type: "SOFTWARE",
              value: "@e5pe0n/turn-ts@0.0.1 client",
            },
            {
              type: "LIFETIME",
              value: 3600,
            },
            {
              type: "REQUESTED-TRANSPORT",
              value: 17,
            },
            {
              type: "DONT-FRAGMENT",
              value: undefined,
            },
            {
              type: "USERNAME",
              value: "user",
            },
            {
              type: "REALM",
              value: "example.com",
            },
            {
              type: "NONCE",
              value: "nonce",
            },
            {
              type: "MESSAGE-INTEGRITY",
              value: expect.any(Buffer),
            },
          ],
        } satisfies TurnMsg);
        await expect(res).resolves.toEqual({
          success: false,
          code: 401,
          reason: "Unauthorized",
        } satisfies AllocateErrorResponse);
      } finally {
        server.close();
        client.close();
      }
    });
  });
});
