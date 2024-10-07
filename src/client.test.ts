import { createSocket } from "node:dgram";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { addrFamilyRecord, compReqAttrTypeRecord } from "./attr.js";
import { Client, type ErrorResponse, type SuccessResponse } from "./client.js";
import { classRecord, methodRecord } from "./header.js";
import { decodeStunMsg, encodeStunMsg } from "./msg.js";

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("req", () => {
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
			const res = await client.req("request", "binding");
			server.close();
			expect(res).toEqual({
				success: false,
				code: 401,
				reason: "Unauthorized",
			} satisfies ErrorResponse);
		});

		describe("transaction", async () => {
			it("retransmits requests according to the RTO=500ms, Rc=7 and Rm=3, then throws a no response error due to timeout", async () => {
				const client = new Client({
					address: "127.0.0.1",
					port: 12345,
					protocol: "udp",
					rtoMs: 500,
					rc: 7,
					rm: 3,
				});
				const dbger = vi.fn();
				const p = client.req("request", "binding", dbger);
				expect(dbger).toHaveBeenCalledTimes(1);
				vi.advanceTimersByTime(500);
				expect(dbger).toHaveBeenCalledTimes(2);
				vi.advanceTimersByTime(2 * 500);
				expect(dbger).toHaveBeenCalledTimes(3);
				vi.advanceTimersByTime(3 * 500);
				expect(p).rejects.toThrowError(/timeout/i);
			});
			it("retransmits requests according to the RTO=500ms, Rc=3 and Rm=16, then throws a no response error due to Rc", async () => {
				const client = new Client({
					address: "127.0.0.1",
					port: 12345,
					protocol: "udp",
					rtoMs: 500,
					rc: 3,
					rm: 16,
				});
				const dbger = vi.fn();
				const p = client.req("request", "binding", dbger);
				expect(dbger).toHaveBeenCalledTimes(1);
				vi.advanceTimersByTime(500);
				expect(dbger).toHaveBeenCalledTimes(2);
				vi.advanceTimersByTime(2 * 500);
				expect(dbger).toHaveBeenCalledTimes(3);
				vi.advanceTimersByTime(3 * 500);
				expect(p).rejects.toThrowError(/rc/i);
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
				const res = await client.req("request", "binding");
				server.close();
				expect(res).toEqual({
					success: true,
					address: "222.62.247.70",
					port: 54321,
				} satisfies SuccessResponse);
			});
		});
	});
});
