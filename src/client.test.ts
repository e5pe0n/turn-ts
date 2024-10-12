import { createSocket } from "node:dgram";
import { describe, expect, it } from "vitest";
import { addrFamilyRecord, compReqAttrTypeRecord } from "./attr.js";
import { Client, type ErrorResponse, type SuccessResponse } from "./client.js";
import { classRecord, methodRecord } from "./header.js";
import { decodeStunMsg, encodeStunMsg } from "./msg.js";

describe("send", () => {
	describe("udp", () => {
		it("receives an error response", async () => {
			const server = createSocket("udp4");
			server.on("message", (msg, rinfo) => {
				const { header, attrs } = decodeStunMsg(msg);
				const res = encodeStunMsg({
					header: {
						cls: classRecord.errorResponse,
						method: header.method,
						trxId: header.trxId,
					},
					attrs: [
						{
							type: compReqAttrTypeRecord["ERROR-CODE"],
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
			server.bind(12345, "127.0.0.1");
			const client = new Client({
				address: "127.0.0.1",
				port: 12345,
				protocol: "udp",
			});
			const res = await client.send("request", "binding");
			server.close();
			expect(res).toEqual({
				success: false,
				code: 401,
				reason: "Unauthorized",
			} satisfies ErrorResponse);
		});

		describe("transaction", async () => {
			it("retransmits requests according to the RTO=100ms, Rc=7 and Rm=4, then throws a no response error due to timeout", async () => {
				const server = createSocket("udp4");
				const resAts: number[] = [];
				server.on("message", (msg, rinfo) => {
					resAts.push(Date.now());
					const { header, attrs } = decodeStunMsg(msg);
				});
				server.bind(12345, "127.0.0.1");
				const client = new Client({
					address: "127.0.0.1",
					port: 12345,
					protocol: "udp",
					rtoMs: 100,
					rc: 7,
					rm: 3,
				});
				const startedAt = Date.now();
				await expect(client.send("request", "binding")).rejects.toThrowError(
					/timeout/i,
				);
				expect(resAts).toHaveLength(4);
				expect(resAts[0]! - startedAt).toBeLessThan(5);
				expect(100 * 1 - (resAts[1]! - resAts[0]!)).toBeLessThan(5);
				expect(100 * 2 - (resAts[2]! - resAts[1]!)).toBeLessThan(5);
				expect(100 * 3 - (resAts[3]! - resAts[2]!)).toBeLessThan(5);
				server.close();
			});
			it("retransmits requests according to the RTO=100ms, Rc=4 and Rm=16, then throws a no response error due to Rc", async () => {
				const server = createSocket("udp4");
				const resAts: number[] = [];
				server.on("message", (msg, rinfo) => {
					resAts.push(Date.now());
					const { header, attrs } = decodeStunMsg(msg);
				});
				server.bind(12345, "127.0.0.1");
				const client = new Client({
					address: "127.0.0.1",
					port: 12345,
					protocol: "udp",
					rtoMs: 100,
					rc: 4,
					rm: 16,
				});
				const startedAt = Date.now();
				await expect(client.send("request", "binding")).rejects.toThrowError(
					/retries/i,
				);
				expect(resAts).toHaveLength(4);
				expect(resAts[0]! - startedAt).toBeLessThan(5);
				expect(100 * 1 - (resAts[1]! - resAts[0]!)).toBeLessThan(5);
				expect(100 * 2 - (resAts[2]! - resAts[1]!)).toBeLessThan(5);
				expect(100 * 3 - (resAts[3]! - resAts[2]!)).toBeLessThan(5);
				server.close();
			});
			it("retransmits requests according to the RTO=100ms, Rc=7 and Rm=16, then return a success response", async () => {
				const server = createSocket("udp4");
				const resAts: number[] = [];
				server.on("message", (msg, rinfo) => {
					resAts.push(Date.now());
					const { header, attrs } = decodeStunMsg(msg);
					if (resAts.length === 2) {
						const res = encodeStunMsg({
							header: {
								cls: classRecord.successResponse,
								method: methodRecord.binding,
								trxId: header.trxId,
							},
							attrs: [
								{
									type: compReqAttrTypeRecord["XOR-MAPPED-ADDRESS"],
									value: {
										family: addrFamilyRecord.ipV4,
										addr: Buffer.from([0xde, 0x3e, 0xf7, 0x46]),
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
				server.bind(12345, "127.0.0.1");
				const client = new Client({
					address: "127.0.0.1",
					port: 12345,
					protocol: "udp",
					rtoMs: 500,
					rc: 4,
					rm: 16,
				});
				const startedAt = Date.now();
				const res = await client.send("request", "binding");
				expect(res).toEqual({
					success: true,
					address: "222.62.247.70",
					port: 54321,
				} satisfies SuccessResponse);
				expect(resAts).toHaveLength(2);
				expect(resAts[0]! - startedAt).toBeLessThan(5);
				expect(100 * 1 - (resAts[1]! - resAts[0]!)).toBeLessThan(5);
				server.close();
			});
		});
	});

	describe("Binding Request", () => {
		it("sends a request then receives a success response", async () => {
			const server = createSocket("udp4");
			server.on("message", (msg, rinfo) => {
				const { header, attrs } = decodeStunMsg(msg);
				const res = encodeStunMsg({
					header: {
						cls: classRecord.successResponse,
						method: methodRecord.binding,
						trxId: header.trxId,
					},
					attrs: [
						{
							type: compReqAttrTypeRecord["XOR-MAPPED-ADDRESS"],
							value: {
								family: addrFamilyRecord.ipV4,
								addr: Buffer.from([0xde, 0x3e, 0xf7, 0x46]),
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
			server.bind(12345, "127.0.0.1");
			const client = new Client({
				address: "127.0.0.1",
				port: 12345,
				protocol: "udp",
			});
			const res = await client.send("request", "binding");
			server.close();
			expect(res).toEqual({
				success: true,
				address: "222.62.247.70",
				port: 54321,
			} satisfies SuccessResponse);
		});
	});
});
