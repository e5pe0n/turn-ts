import { genPromise } from "@e5pe0n/lib";
import { createSocket } from "node:dgram";
import { describe, expect, it } from "vitest";
import { TcpAgent, UdpAgent } from "./agent.js";
import { Client } from "./client.js";
import { StunMsg } from "./msg.js";
import { magicCookie } from "./common.js";
import { createServer } from "node:net";

describe("with UdpAgent", () => {
  describe("indicate()", () => {
    it("sends binding indications", async () => {
      // Arrange
      const server = createSocket("udp4");
      const gen = genPromise<Buffer>((genResolvers) => {
        server.on("message", (msg, rinfo) => {
          const { resolve } = genResolvers.next().value!;
          resolve(msg);
        });
      });
      const agent = new UdpAgent({
        to: {
          address: "127.0.0.1",
          port: 12345,
        },
      });
      const client = new Client({
        agent,
      });
      server.bind(12345, "127.0.0.1");

      try {
        {
          // Act
          await client.indicate();
          const buf = (await gen.next()).value;

          // Assert
          const indi = StunMsg.from(buf!);
          expect(indi).toEqual({
            header: {
              cls: "Indication",
              method: "Binding",
              trxId: expect.any(Buffer),
              length: 0,
              magicCookie,
            },
            attrs: {},
            raw: expect.any(Buffer),
          } satisfies StunMsg);
        }
        {
          // Act
          await client.indicate();
          const buf = (await gen.next()).value;

          // Assert
          const indi = StunMsg.from(buf!);
          expect(indi).toEqual({
            header: {
              cls: "Indication",
              method: "Binding",
              trxId: expect.any(Buffer),
              length: 0,
              magicCookie,
            },
            attrs: {},
            raw: expect.any(Buffer),
          } satisfies StunMsg);
        }
      } finally {
        client.close();
        server.close();
      }
    });
  });

  describe("request()", () => {
    it("sends binding requests then returns responses", async () => {
      // Arrange
      const server = createSocket("udp4");
      const gen = genPromise<Buffer>((genResolvers) => {
        server.on("message", (msg, rinfo) => {
          const { resolve } = genResolvers.next().value!;
          resolve(msg);
          const req = StunMsg.from(msg);
          const resp = StunMsg.build({
            header: {
              cls: "SuccessResponse",
              method: req.header.method,
              trxId: req.header.trxId,
            },
            attrs: {
              xorMappedAddress: {
                family: "IPv4",
                port: 12345,
                address: "201.199.197.89",
              },
            },
          });
          server.send(resp.raw, rinfo.port, rinfo.address);
        });
      });
      server.bind(12345, "127.0.0.1");
      const agent = new UdpAgent({
        to: {
          address: "127.0.0.1",
          port: 12345,
        },
      });
      const client = new Client({
        agent,
      });

      try {
        {
          // Act
          const resp = await client.request();
          const reqBuf = (await gen.next()).value!;

          // Assert
          const req = StunMsg.from(reqBuf);
          expect(req).toEqual({
            header: {
              cls: "Request",
              method: "Binding",
              trxId: expect.any(Buffer),
              length: 0,
              magicCookie,
            },
            attrs: {},
            raw: expect.any(Buffer),
          } satisfies StunMsg);

          expect(resp).toEqual({
            header: {
              cls: "SuccessResponse",
              method: "Binding",
              trxId: req.header.trxId,
              length: 12,
              magicCookie,
            },
            attrs: {
              xorMappedAddress: {
                family: "IPv4",
                port: 12345,
                address: "201.199.197.89",
              },
            },
            raw: expect.any(Buffer),
          } satisfies StunMsg);
        }
        {
          // Act
          const resp = await client.request();
          const reqBuf = (await gen.next()).value!;

          // Assert
          const req = StunMsg.from(reqBuf);
          expect(req).toEqual({
            header: {
              cls: "Request",
              method: "Binding",
              trxId: expect.any(Buffer),
              length: 0,
              magicCookie,
            },
            attrs: {},
            raw: expect.any(Buffer),
          } satisfies StunMsg);

          expect(resp).toEqual({
            header: {
              cls: "SuccessResponse",
              method: "Binding",
              trxId: req.header.trxId,
              length: 12,
              magicCookie,
            },
            attrs: {
              xorMappedAddress: {
                family: "IPv4",
                port: 12345,
                address: "201.199.197.89",
              },
            },
            raw: expect.any(Buffer),
          } satisfies StunMsg);
        }
      } finally {
        client.close();
        server.close();
      }
    });
  });
});

describe("with TcpAgent", () => {
  describe("indicate()", () => {
    it("sends binding indications", async () => {
      // Arrange
      const server = createServer();
      const gen = genPromise<Buffer>((genResolvers) => {
        server.on("connection", (conn) => {
          conn.on("data", (data) => {
            const { resolve } = genResolvers.next().value!;
            resolve(data);
          });
        });
      });
      const agent = new TcpAgent({
        to: {
          address: "127.0.0.1",
          port: 12345,
        },
      });
      const client = new Client({
        agent,
      });
      server.listen(12345, "127.0.0.1");

      try {
        {
          // Act
          await client.indicate();
          const buf = (await gen.next()).value;

          // Assert
          const indi = StunMsg.from(buf!);
          expect(indi).toEqual({
            header: {
              cls: "Indication",
              method: "Binding",
              trxId: expect.any(Buffer),
              length: 0,
              magicCookie,
            },
            attrs: {},
            raw: expect.any(Buffer),
          } satisfies StunMsg);
        }
        {
          // Act
          await client.indicate();
          const buf = (await gen.next()).value;

          // Assert
          const indi = StunMsg.from(buf!);
          expect(indi).toEqual({
            header: {
              cls: "Indication",
              method: "Binding",
              trxId: expect.any(Buffer),
              length: 0,
              magicCookie,
            },
            attrs: {},
            raw: expect.any(Buffer),
          } satisfies StunMsg);
        }
      } finally {
        client.close();
        server.close();
      }
    });
  });
  describe("request()", () => {
    it("sends binding requests then returns responses", async () => {
      // Arrange
      const server = createServer();
      const gen = genPromise<Buffer>((genResolvers) => {
        server.on("connection", (conn) => {
          conn.on("data", (data) => {
            const { resolve } = genResolvers.next().value!;
            const req = StunMsg.from(data);
            const resp = StunMsg.build({
              header: {
                cls: "SuccessResponse",
                method: req.header.method,
                trxId: req.header.trxId,
              },
              attrs: {
                xorMappedAddress: {
                  family: "IPv4",
                  port: 12345,
                  address: "201.199.197.89",
                },
              },
            });
            conn.write(resp.raw);
            conn.end();
            resolve(data);
          });
        });
      });
      const agent = new TcpAgent({
        to: {
          address: "127.0.0.1",
          port: 12345,
        },
      });
      const client = new Client({
        agent,
      });
      server.listen(12345, "127.0.0.1");

      try {
        {
          // Act
          const resp = await client.request();
          const reqBuf = (await gen.next()).value!;

          // Assert
          const req = StunMsg.from(reqBuf);
          expect(req).toEqual({
            header: {
              cls: "Request",
              method: "Binding",
              trxId: expect.any(Buffer),
              length: 0,
              magicCookie,
            },
            attrs: {},
            raw: expect.any(Buffer),
          } satisfies StunMsg);

          expect(resp).toEqual({
            header: {
              cls: "SuccessResponse",
              method: "Binding",
              trxId: req.header.trxId,
              length: 12,
              magicCookie,
            },
            attrs: {
              xorMappedAddress: {
                family: "IPv4",
                port: 12345,
                address: "201.199.197.89",
              },
            },
            raw: expect.any(Buffer),
          } satisfies StunMsg);
        }
        {
          // Act
          const resp = await client.request();
          const reqBuf = (await gen.next()).value!;

          // Assert
          const req = StunMsg.from(reqBuf);
          expect(req).toEqual({
            header: {
              cls: "Request",
              method: "Binding",
              trxId: expect.any(Buffer),
              length: 0,
              magicCookie,
            },
            attrs: {},
            raw: expect.any(Buffer),
          } satisfies StunMsg);

          expect(resp).toEqual({
            header: {
              cls: "SuccessResponse",
              method: "Binding",
              trxId: req.header.trxId,
              length: 12,
              magicCookie,
            },
            attrs: {
              xorMappedAddress: {
                family: "IPv4",
                port: 12345,
                address: "201.199.197.89",
              },
            },
            raw: expect.any(Buffer),
          } satisfies StunMsg);
        }
      } finally {
        client.close();
        server.close();
      }
    });
  });
});
