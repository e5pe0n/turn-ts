import { createSocket } from "node:dgram";
import { createServer } from "node:net";
import { describe, expect, expectTypeOf, it } from "vitest";
import { assertRawStunFmtMsg } from "./agent.js";
import {
  Client,
  type ClientConfig,
  type ErrorResponse,
  type SuccessResponse,
} from "./client.js";
import { decodeStunMsg, encodeStunMsg } from "./msg.js";

describe("types", () => {
  test("udp types inferred when passing 'udp' to protocol in config without explicit type parameter", () => {
    const client = new Client({
      protocol: "udp",
      dest: {
        address: "127.0.0.1",
        port: 3478,
      },
    });
    expectTypeOf(client).toEqualTypeOf<Client<"udp">>();
    expectTypeOf(client.config).toEqualTypeOf<ClientConfig<"udp">>();
  });
  test("udp types inferred when passing 'udp' to protocol in config without explicit type parameter", () => {
    const client = new Client({
      protocol: "tcp",
      dest: {
        address: "127.0.0.1",
        port: 3478,
      },
    });
    expectTypeOf(client).toEqualTypeOf<Client<"tcp">>();
    expectTypeOf(client.config).toEqualTypeOf<ClientConfig<"tcp">>();
  });
});

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
        const client = new Client({
          protocol: "udp",
          dest: {
            address: "127.0.0.1",
            port: 12345,
          },
        });
        try {
          server.bind(12345, "127.0.0.1");

          // Act
          await client.indicate();
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
      it("sends a request then receives a success response", async () => {
        // Arrange
        const server = createSocket("udp4");
        server.on("message", (msg, rinfo) => {
          assertRawStunFmtMsg(msg);
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
          const client = new Client({
            protocol: "udp",
            dest: {
              address: "127.0.0.1",
              port: 12345,
            },
          });
          server.bind(12345, "127.0.0.1");

          // Act
          const res = await client.request();

          // Assert
          expect(res).toEqual({
            success: true,
            family: "IPv4",
            address: "222.62.247.70",
            port: 54321,
          } satisfies SuccessResponse);
        } finally {
          server.close();
        }
      });
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
        const client = new Client({
          protocol: "tcp",
          dest: {
            address: "127.0.0.1",
            port: 12345,
          },
        });
        try {
          server.listen(12345, "127.0.0.1");

          // Act
          await client.indicate();
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
            assertRawStunFmtMsg(data);
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
        const client = new Client({
          protocol: "tcp",
          dest: {
            address: "127.0.0.1",
            port: 12345,
          },
        });
        try {
          server.listen(12345, "127.0.0.1");

          // Act
          const res = await client.request();

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
      it("sends a binding request then receives a success response", async () => {
        // Arrange
        let resolve: (value: Buffer | PromiseLike<Buffer>) => void;
        const p = new Promise<Buffer>((res, rej) => {
          resolve = res;
        });
        const server = createServer((conn) => {
          conn.on("data", (data) => {
            assertRawStunFmtMsg(data);
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
        const client = new Client({
          protocol: "tcp",
          dest: {
            address: "127.0.0.1",
            port: 12345,
          },
        });
        try {
          server.listen(12345, "127.0.0.1");

          // Act
          const res = await client.request();
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
            family: "IPv4",
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
