import { createSocket } from "node:dgram";
import { createServer } from "node:net";
import { describe, expect, it } from "vitest";
import {
  type ErrorResponse,
  type SuccessResponse,
  createClient,
} from "./client.js";
import { decodeStunMsg, encodeStunMsg } from "./msg.js";

describe("send", () => {
  describe("udp", () => {
    describe("Binding Indication", () => {
      it("sends a binding indication", async () => {
        // Arrange
        const server = createSocket("udp4");
        const res = new Promise<Buffer>((resolve, reject) => {
          server.on("message", (msg, rinfo) => {
            resolve(msg);
          });
        });
        const client = createClient({
          address: "127.0.0.1",
          port: 12345,
          protocol: "udp",
        });
        try {
          server.bind(12345, "127.0.0.1");

          // Act
          await client.send("Indication", "Binding");
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
    describe("Binding Request", () => {
      it("receives an error response", async () => {
        // Arrange
        const server = createSocket("udp4");
        server.on("message", (msg, rinfo) => {
          const { header, attrs } = decodeStunMsg(msg);
          const res = encodeStunMsg({
            header: {
              cls: "ErrorResponse",
              method: header.method,
              trxId: header.trxId,
            },
            attrs: [
              {
                type: "ERROR-CODE",
                value: {
                  code: 401,
                  reason: "Unauthorized",
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
        const client = createClient({
          address: "127.0.0.1",
          port: 12345,
          protocol: "udp",
        });
        try {
          server.bind(12345, "127.0.0.1");

          // Act
          const res = await client.send("Request", "Binding");

          // Assert
          expect(res).toEqual({
            success: false,
            code: 401,
            reason: "Unauthorized",
          } satisfies ErrorResponse);
        } finally {
          server.close();
        }
      });
      it("retransmits requests according to the RTO=100ms, Rc=7 and Rm=4, then throws a no response error due to timeout", async () => {
        // Arrange
        const server = createSocket("udp4");
        const resAts: number[] = [];
        server.on("message", (msg, rinfo) => {
          resAts.push(Date.now());
          const { header, attrs } = decodeStunMsg(msg);
        });
        const client = createClient({
          address: "127.0.0.1",
          port: 12345,
          protocol: "udp",
          rtoMs: 100,
          rc: 7,
          rm: 3,
        });
        try {
          server.bind(12345, "127.0.0.1");

          // Act & Assert
          const startedAt = Date.now();
          await expect(client.send("Request", "Binding")).rejects.toThrowError(
            /timeout/i,
          );
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
          const { header, attrs } = decodeStunMsg(msg);
        });
        const client = createClient({
          address: "127.0.0.1",
          port: 12345,
          protocol: "udp",
          rtoMs: 100,
          rc: 4,
          rm: 16,
        });
        try {
          server.bind(12345, "127.0.0.1");

          // Act && Assert
          const startedAt = Date.now();
          await expect(client.send("Request", "Binding")).rejects.toThrowError(
            /retries/i,
          );
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

        const client = createClient({
          address: "127.0.0.1",
          port: 12345,
          protocol: "udp",
          rtoMs: 500,
          rc: 4,
          rm: 16,
        });
        try {
          server.bind(12345, "127.0.0.1");

          // Act
          const startedAt = Date.now();
          const res = await client.send("Request", "Binding");

          // Assert
          expect(res).toEqual({
            success: true,
            address: "222.62.247.70",
            port: 54321,
          } satisfies SuccessResponse);
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
        const client = createClient({
          address: "127.0.0.1",
          port: 12345,
          protocol: "udp",
        });
        server.bind(12345, "127.0.0.1");

        // Act
        const res = await client.send("Request", "Binding");

        // Assert
        expect(res).toEqual({
          success: true,
          address: "222.62.247.70",
          port: 54321,
        } satisfies SuccessResponse);
      } finally {
        server.close();
      }
    });
  });

  describe("tcp", () => {
    describe("Binding Indication", () => {
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
        const client = createClient({
          protocol: "tcp",
          address: "127.0.0.1",
          port: 12345,
        });
        try {
          server.listen(12345, "127.0.0.1");

          // Act
          await client.send("Indication", "Binding");
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
      it("can receive an error response", async () => {
        // Arrange
        const server = createServer((conn) => {
          conn.on("data", (data) => {
            const { header } = decodeStunMsg(data);
            const res = encodeStunMsg({
              header: {
                cls: "ErrorResponse",
                method: header.method,
                trxId: header.trxId,
              },
              attrs: [
                {
                  type: "ERROR-CODE",
                  value: {
                    code: 401,
                    reason: "Unauthorized",
                  },
                },
              ],
            });
            conn.write(res);
            conn.end();
          });
        });
        server.on("error", (err) => {
          throw err;
        });
        const client = createClient({
          protocol: "tcp",
          address: "127.0.0.1",
          port: 12345,
        });
        try {
          server.listen(12345, "127.0.0.1");

          // Act
          const res = await client.send("Request", "Binding");

          // Assert
          expect(res).toEqual({
            success: false,
            code: 401,
            reason: "Unauthorized",
          } satisfies ErrorResponse);
        } finally {
          server.close();
        }
      });
      it("throws a timeout error if reached the timeout", async () => {
        const server = createServer();
        server.on("error", (err) => {
          throw err;
        });
        const client = createClient({
          protocol: "tcp",
          address: "127.0.0.1",
          port: 12345,
          tiMs: 100,
        });
        try {
          server.listen(12345, "127.0.0.1");

          // Act and Assert
          await expect(client.send("Request", "Binding")).rejects.toThrowError(
            /timeout/i,
          );
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
        const client = createClient({
          protocol: "tcp",
          address: "127.0.0.1",
          port: 12345,
        });
        try {
          server.listen(12345, "127.0.0.1");

          // Act
          const res = await client.send("Request", "Binding");
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
          expect(res).toEqual({
            success: true,
            address: "222.62.247.70",
            port: 54321,
          } satisfies SuccessResponse);
        } finally {
          server.close();
        }
      });
    });
  });
});
