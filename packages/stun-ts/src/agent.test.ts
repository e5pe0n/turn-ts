import { randomBytes } from "node:crypto";
import { createSocket } from "node:dgram";
import { createServer } from "node:net";
import { describe, expect, it } from "vitest";
import { TcpAgent, UdpAgent, assertStunMSg } from "./agent.js";
import { magicCookie } from "./consts.js";
import { type StunMsg, decodeStunMsg, encodeStunMsg } from "./msg.js";

describe("assertStunMsg", () => {
  it("throws an error if the STUN message is not >= 20 bytes", () => {
    const buf = Buffer.from([
      // 8 bytes
      0x00, // STUN Message Type
      0x01,
      0x00, // Message Length
      0x08,
      0x21, // Magic Cookie
      0x12,
      0xa4,
      0x42,
      // Trx Id (12 - 1 bytes)
      0x81,
      0x4c,
      0x72,
      0x09,
      0xa7,
      0x68,
      0xf9,
      0x89,
      0xf8,
      0x0b,
      0x73,
      // 0xbd		-1 byte
    ]);
    expect(() => assertStunMSg(buf)).toThrowError(/invalid stun msg/i);
  });
  it("throws an error if the length of a STUN message is not a multiple of 4", () => {
    const trxId = Buffer.from([
      0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
    ]);
    const hBuf = Buffer.concat([
      Buffer.from([
        0x00, // STUN Message Type: Binding request
        0x01,
        0x00, // Message Length: 12 bytes
        0x0c,
        0x21, // Magic Cookie
        0x12,
        0xa4,
        0x42,
      ]),
      trxId,
    ]);
    const buf = Buffer.concat([
      hBuf, // 20 bytes
      Buffer.alloc(1),
    ]);
    expect(() => assertStunMSg(buf)).toThrowError(/invalid stun msg/i);
  });
  it("throws error if a STUN message header does not include valid magic cookie", () => {
    const trxId = Buffer.from([
      0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
    ]);
    const buf = Buffer.concat([
      Buffer.from([
        0x00, // STUN Message Type
        0x01,
        0x10, // Message Length
        0x11,
        0x21, // Magic Cookie
        0x12,
        0xa4,
        0x41,
      ]),
      trxId,
    ]);
    expect(() => assertStunMSg(buf)).toThrowError(/invalid magic cookie/);
  });
});

describe("send", () => {
  describe("udp", () => {
    describe("Indication", () => {
      it("sends an indication", async () => {
        // Arrange
        const server = createSocket("udp4");
        const res = new Promise<Buffer>((resolve, reject) => {
          server.on("message", (msg, rinfo) => {
            resolve(msg);
          });
        });
        const agent = new UdpAgent({
          dest: {
            address: "127.0.0.1",
            port: 12345,
          },
        });
        try {
          server.bind(12345, "127.0.0.1");

          // Act
          const msg = encodeStunMsg({
            header: {
              cls: "Indication",
              method: "Binding",
              trxId: randomBytes(12),
            },
            attrs: [],
          });
          await agent.indicate(msg);
          const buf = await res;

          // Assert
          expect(buf).toHaveLength(20);
          expect(buf.subarray(0, 8)).toEqual(
            Buffer.concat([
              Buffer.from([
                0x00, // STUN Message Type
                0x11,
                0x00, // Message Length
                0x00,
                0x21, // Magic Cookie
                0x12,
                0xa4,
                0x42,
              ]),
            ]),
          );
        } finally {
          server.close();
        }
      });
    });
    describe("Request", () => {
      it("retransmits requests according to the RTO=100ms, Rc=7 and Rm=4, then throws a no response error due to timeout", async () => {
        // Arrange
        const server = createSocket("udp4");
        const resAts: number[] = [];
        server.on("message", (msg, rinfo) => {
          resAts.push(Date.now());
          assertStunMSg(msg);
        });
        const agent = new UdpAgent({
          dest: {
            address: "127.0.0.1",
            port: 12345,
          },
          rtoMs: 100,
          rc: 7,
          rm: 3,
        });
        try {
          server.bind(12345, "127.0.0.1");

          // Act & Assert
          const msg = encodeStunMsg({
            header: {
              cls: "Indication",
              method: "Binding",
              trxId: randomBytes(12),
            },
            attrs: [],
          });
          const startedAt = Date.now();
          await expect(agent.request(msg)).rejects.toThrowError(/timeout/i);
          expect(resAts).toHaveLength(4);
          expect(resAts[0]! - startedAt).toBeLessThan(5);
          expect(100 * 1 - (resAts[1]! - resAts[0]!)).toBeLessThan(5);
          expect(100 * 2 - (resAts[2]! - resAts[1]!)).toBeLessThan(5);
          expect(100 * 3 - (resAts[3]! - resAts[2]!)).toBeLessThan(5);
        } finally {
          server.close();
        }
      });
      it("retransmits requests according to the RTO=100ms, Rc=4 and Rm=16, then throws a no response error due to Rc", async () => {
        // Arrange
        const server = createSocket("udp4");
        const resAts: number[] = [];
        server.on("message", (msg, rinfo) => {
          resAts.push(Date.now());
          assertStunMSg(msg);
        });
        const agent = new UdpAgent({
          dest: {
            address: "127.0.0.1",
            port: 12345,
          },
          rtoMs: 100,
          rc: 4,
          rm: 16,
        });
        try {
          server.bind(12345, "127.0.0.1");

          // Act && Assert
          const msg = encodeStunMsg({
            header: {
              cls: "Indication",
              method: "Binding",
              trxId: randomBytes(12),
            },
            attrs: [],
          });
          const startedAt = Date.now();
          await expect(agent.request(msg)).rejects.toThrowError(/retries/i);
          expect(resAts).toHaveLength(4);
          expect(resAts[0]! - startedAt).toBeLessThan(5);
          expect(100 * 1 - (resAts[1]! - resAts[0]!)).toBeLessThan(5);
          expect(100 * 2 - (resAts[2]! - resAts[1]!)).toBeLessThan(5);
          expect(100 * 3 - (resAts[3]! - resAts[2]!)).toBeLessThan(5);
        } finally {
          server.close();
        }
      });
      it("retransmits requests according to the RTO=100ms, Rc=7 and Rm=16, then return a success response", async () => {
        // Arrange
        const server = createSocket("udp4");
        const resAts: number[] = [];
        server.on("message", (msg, rinfo) => {
          resAts.push(Date.now());
          assertStunMSg(msg);
          const { header, attrs } = decodeStunMsg(msg);
          if (resAts.length === 2) {
            const res = encodeStunMsg({
              header: {
                cls: "SuccessResponse",
                method: "Binding",
                trxId: header.trxId,
              },
              attrs: [
                {
                  type: "XOR-MAPPED-ADDRESS",
                  value: {
                    family: "IPv4",
                    address: "222.62.247.70",
                    port: 54321,
                  },
                },
              ],
            });
            server.send(res, rinfo.port, rinfo.address, (err, bytes) => {
              if (err) {
                throw err;
              }
            });
          }
        });

        const agent = new UdpAgent({
          dest: {
            address: "127.0.0.1",
            port: 12345,
          },
          rtoMs: 500,
          rc: 4,
          rm: 16,
        });
        try {
          server.bind(12345, "127.0.0.1");

          // Act
          const msg = encodeStunMsg({
            header: {
              cls: "Indication",
              method: "Binding",
              trxId: randomBytes(12),
            },
            attrs: [],
          });
          const startedAt = Date.now();
          const res = await agent.request(msg);

          // Assert
          expect(decodeStunMsg(res)).toEqual({
            header: {
              cls: "SuccessResponse",
              method: "Binding",
              trxId: expect.any(Buffer),
              length: 12,
              magicCookie,
            },
            attrs: [
              {
                type: "XOR-MAPPED-ADDRESS",
                value: {
                  family: "IPv4",
                  address: "222.62.247.70",
                  port: 54321,
                },
              },
            ],
          } satisfies StunMsg);
          expect(resAts).toHaveLength(2);
          expect(resAts[0]! - startedAt).toBeLessThan(5);
          expect(100 * 1 - (resAts[1]! - resAts[0]!)).toBeLessThan(5);
        } finally {
          server.close();
        }
      });
    });
    it("sends a request then receives a success response", async () => {
      // Arrange
      const server = createSocket("udp4");
      server.on("message", (msg, rinfo) => {
        assertStunMSg(msg);
        const { header, attrs } = decodeStunMsg(msg);
        const res = encodeStunMsg({
          header: {
            cls: "SuccessResponse",
            method: "Binding",
            trxId: header.trxId,
          },
          attrs: [
            {
              type: "XOR-MAPPED-ADDRESS",
              value: {
                family: "IPv4",
                address: "222.62.247.70",
                port: 54321,
              },
            },
          ],
        });
        server.send(res, rinfo.port, rinfo.address, (err, bytes) => {
          if (err) {
            throw err;
          }
        });
      });
      try {
        const agent = new UdpAgent({
          dest: {
            address: "127.0.0.1",
            port: 12345,
          },
        });
        server.bind(12345, "127.0.0.1");

        // Act
        const msg = encodeStunMsg({
          header: {
            cls: "Indication",
            method: "Binding",
            trxId: randomBytes(12),
          },
          attrs: [],
        });
        const res = await agent.request(msg);

        // Assert
        expect(decodeStunMsg(res)).toEqual({
          header: {
            cls: "SuccessResponse",
            method: "Binding",
            trxId: expect.any(Buffer),
            length: 12,
            magicCookie,
          },
          attrs: [
            {
              type: "XOR-MAPPED-ADDRESS",
              value: {
                family: "IPv4",
                address: "222.62.247.70",
                port: 54321,
              },
            },
          ],
        } satisfies StunMsg);
      } finally {
        server.close();
      }
    });
  });

  describe("tcp", () => {
    describe("Indication", () => {
      it("sends a binding indication", async () => {
        // Arrange
        let resolve: (value: Buffer | PromiseLike<Buffer>) => void;
        const p = new Promise<Buffer>((res, rej) => {
          resolve = res;
        });
        const server = createServer((conn) => {
          conn.on("data", (data) => {
            conn.end();
            resolve(data);
          });
        });
        server.on("error", (err) => {
          throw err;
        });
        const agent = new TcpAgent({
          dest: {
            address: "127.0.0.1",
            port: 12345,
          },
        });
        try {
          server.listen(12345, "127.0.0.1");

          // Act
          const msg = encodeStunMsg({
            header: {
              cls: "Indication",
              method: "Binding",
              trxId: randomBytes(12),
            },
            attrs: [],
          });
          await agent.indicate(msg);
          const buf = await p;

          // Assert
          expect(buf).toHaveLength(20);
          expect(buf.subarray(0, 8)).toEqual(
            Buffer.concat([
              Buffer.from([
                0x00, // STUN Message Type
                0x11,
                0x00, // Message Length
                0x00,
                0x21, // Magic Cookie
                0x12,
                0xa4,
                0x42,
              ]),
            ]),
          );
        } finally {
          server.close();
        }
      });
    });

    describe("Binding Request", () => {
      it("throws a timeout error if reached the timeout", async () => {
        const server = createServer();
        server.on("error", (err) => {
          throw err;
        });
        const agent = new TcpAgent({
          dest: {
            address: "127.0.0.1",
            port: 12345,
          },
          tiMs: 100,
        });
        try {
          server.listen(12345, "127.0.0.1");

          // Act and Assert
          const msg = encodeStunMsg({
            header: {
              cls: "Request",
              method: "Binding",
              trxId: randomBytes(12),
            },
            attrs: [],
          });
          await expect(agent.request(msg)).rejects.toThrowError(/timeout/i);
        } finally {
          server.close();
        }
      });
      it("sends a binding request then receives a success response", async () => {
        // Arrange
        let resolve: (value: Buffer | PromiseLike<Buffer>) => void;
        const p = new Promise<Buffer>((res, rej) => {
          resolve = res;
        });
        const server = createServer((conn) => {
          conn.on("data", (data) => {
            assertStunMSg(data);
            const {
              header: { trxId },
            } = decodeStunMsg(data);
            const res = encodeStunMsg({
              header: {
                cls: "SuccessResponse",
                method: "Binding",
                trxId,
              },
              attrs: [
                {
                  type: "XOR-MAPPED-ADDRESS",
                  value: {
                    family: "IPv4",
                    address: "222.62.247.70",
                    port: 54321,
                  },
                },
              ],
            });
            conn.write(res);
            conn.end();
            resolve(data);
          });
        });
        server.on("error", (err) => {
          throw err;
        });
        const agent = new TcpAgent({
          dest: {
            address: "127.0.0.1",
            port: 12345,
          },
        });
        try {
          server.listen(12345, "127.0.0.1");

          // Act
          const msg = encodeStunMsg({
            header: {
              cls: "Request",
              method: "Binding",
              trxId: randomBytes(12),
            },
            attrs: [],
          });
          const res = await agent.request(msg);
          const reqBuf = await p;

          // Assert
          expect(reqBuf).toHaveLength(20);
          expect(reqBuf.subarray(0, 8)).toEqual(
            Buffer.concat([
              Buffer.from([
                0x00, // STUN Message Type
                0x01,
                0x00, // Message Length
                0x00,
                0x21, // Magic Cookie
                0x12,
                0xa4,
                0x42,
              ]),
            ]),
          );
          expect(decodeStunMsg(res)).toEqual({
            header: {
              cls: "SuccessResponse",
              method: "Binding",
              trxId: expect.any(Buffer),
              length: 12,
              magicCookie,
            },
            attrs: [
              {
                type: "XOR-MAPPED-ADDRESS",
                value: {
                  family: "IPv4",
                  address: "222.62.247.70",
                  port: 54321,
                },
              },
            ],
          } satisfies StunMsg);
        } finally {
          server.close();
        }
      });
    });
  });
});
