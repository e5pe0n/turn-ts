import { genPromise } from "@e5pe0n/lib";
import { createSocket } from "node:dgram";
import { createServer } from "node:net";
import { setTimeout } from "node:timers/promises";
import { describe, expect, it, test } from "vitest";
import { TcpAgent, UdpAgent } from "./agent.js";

describe("UdpAgent", () => {
  test("indicate()", async () => {
    // Arrange
    const server = createSocket("udp4");
    const gen = genPromise<Buffer>((genResolvers) => {
      server.on("message", (msg) => {
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
    server.bind(12345, "127.0.0.1");

    try {
      {
        // Act
        const msg = Buffer.from([1]);
        await agent.indicate(msg);
        const buf = (await gen.next()).value;

        // Assert
        expect(buf).toEqual(msg);
      }
      {
        // Act
        const msg = Buffer.from([2]);
        await agent.indicate(msg);
        const buf = (await gen.next()).value;

        // Assert
        expect(buf).toEqual(msg);
      }
    } finally {
      server.close();
      agent.close();
    }
  });

  describe("request()", () => {
    it("retransmits requests with RTO=10ms, Rc=7 and Rm=3, then throws an error due to timeout", async () => {
      // Arrange
      const server = createSocket("udp4");
      const resAts: number[] = [];
      server.on("message", (msg, rinfo) => {
        resAts.push(Date.now());
      });
      const agent = new UdpAgent({
        to: {
          address: "127.0.0.1",
          port: 12345,
        },
        rtoMs: 10,
        rc: 7,
        rm: 3,
      });
      server.bind(12345, "127.0.0.1");

      try {
        // Act & Assert
        const msg = Buffer.alloc(1);
        await expect(agent.request(msg)).rejects.toThrowError(/timeout/i);
        expect(resAts).toHaveLength(4);
        expect(10 * 1 - (resAts[1]! - resAts[0]!)).toBeLessThan(5);
        expect(10 * 2 - (resAts[2]! - resAts[1]!)).toBeLessThan(5);
        expect(10 * 3 - (resAts[3]! - resAts[2]!)).toBeLessThan(5);
      } finally {
        server.close();
        agent.close();
      }
    });
    it("retransmits requests with RTO=10ms, Rc=4 and Rm=16, then throws an error due to Rc", async () => {
      // Arrange
      const server = createSocket("udp4");
      const resAts: number[] = [];
      server.on("message", (msg, rinfo) => {
        resAts.push(Date.now());
      });
      const agent = new UdpAgent({
        to: {
          address: "127.0.0.1",
          port: 12345,
        },
        rtoMs: 10,
        rc: 4,
        rm: 16,
      });
      server.bind(12345, "127.0.0.1");

      try {
        // Act && Assert
        const msg = Buffer.alloc(1);
        await expect(agent.request(msg)).rejects.toThrowError(
          /reached max attempts/i,
        );
        await setTimeout(0); // wait for server receives the last msg
        expect(resAts).toHaveLength(4);
        expect(10 * 1 - (resAts[1]! - resAts[0]!)).toBeLessThan(5);
        expect(10 * 2 - (resAts[2]! - resAts[1]!)).toBeLessThan(5);
        expect(10 * 3 - (resAts[3]! - resAts[2]!)).toBeLessThan(5);
      } finally {
        server.close();
        agent.close();
      }
    });
    it("retransmits requests with RTO=10ms, Rc=7 and Rm=16, then returns a response", async () => {
      // Arrange
      const server = createSocket("udp4");
      const resAts: number[] = [];
      server.on("message", (msg, rinfo) => {
        resAts.push(Date.now());
        if (resAts.length === 2) {
          server.send(
            Buffer.from([1]),
            rinfo.port,
            rinfo.address,
            (err, bytes) => {
              if (err) {
                throw err;
              }
            },
          );
        }
      });

      const agent = new UdpAgent({
        to: {
          address: "127.0.0.1",
          port: 12345,
        },
        rtoMs: 10,
        rc: 4,
        rm: 16,
      });
      server.bind(12345, "127.0.0.1");

      try {
        // Act
        const msg = Buffer.alloc(1);
        const resp = await agent.request(msg);

        // Assert
        expect(resp).toEqual(Buffer.from([1]));
        expect(resAts).toHaveLength(2);
        expect(10 * 1 - (resAts[1]! - resAts[0]!)).toBeLessThan(5);
      } finally {
        agent.close();
        server.close();
      }
    });
  });
});

describe("TcpAgent", () => {
  test("indicate()", async () => {
    // // Arrange
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
    server.listen(12345, "127.0.0.1");

    try {
      {
        // Act
        const msg = Buffer.from([1]);
        await agent.indicate(msg);
        const buf = (await gen.next()).value;

        // Assert
        expect(buf).toEqual(msg);
      }
      {
        // Act

        const msg = Buffer.from([2]);
        await agent.indicate(msg);
        const buf = (await gen.next()).value;

        // Assert
        expect(buf).toEqual(msg);
      }
    } finally {
      agent.close();
      server.close();
    }
  });
  describe("request()", () => {
    it("throws a timeout error if reached the timeout", async () => {
      const server = createServer();
      server.on("error", (err) => {
        throw err;
      });
      const agent = new TcpAgent({
        to: {
          address: "127.0.0.1",
          port: 12345,
        },
        tiMs: 10,
      });
      server.listen(12345, "127.0.0.1");

      try {
        // Act and Assert
        const msg = Buffer.alloc(1);
        await expect(agent.request(msg)).rejects.toThrowError(/timeout/i);
      } finally {
        server.close();
      }
    });
    it("sends request data then returns response data", async () => {
      // Arrange
      const server = createServer();
      const gen = genPromise((genResolvers) => {
        let cnt = 0;
        server.on("connection", (conn) => {
          conn.on("data", (data) => {
            const { resolve } = genResolvers.next().value!;
            const resp = Buffer.from(`resp${++cnt}`);
            conn.write(resp);
            conn.end();
            // console.log("resolve.fname", resolve.fname);
            resolve(data);
          });
        });
      });
      server.on("error", (err) => {
        throw err;
      });
      const agent = new TcpAgent({
        to: {
          address: "127.0.0.1",
          port: 12345,
        },
      });
      server.listen(12345, "127.0.0.1");

      try {
        {
          // Act & Assert
          const msg = Buffer.from("req1");
          const resp = await agent.request(msg);
          expect(resp).toEqual(Buffer.from("resp1"));
          const sentMsg = (await gen.next()).value;
          expect(sentMsg).toEqual(msg);
        }
        {
          // Act & Act
          const msg = Buffer.from("req2");
          const resp = await agent.request(msg);
          expect(resp).toEqual(Buffer.from("resp2"));
          const sentMsg = (await gen.next()).value;
          expect(sentMsg).toEqual(msg);
        }
      } finally {
        server.close();
      }
    });
  });
});
