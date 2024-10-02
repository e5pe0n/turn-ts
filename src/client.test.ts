import { describe, expect, it } from "vitest";
import { Client, type SuccessResponse } from "./client.js";
import { createSocket } from "node:dgram";
import { decodeStunMsg, encodeStunMsg } from "./msg.js";
import { classRecord, methodRecord } from "./header.js";
import { addrFamilyRecord, compReqAttrTypeRecord } from "./attr.js";

describe("req", () => {
	describe("udp", () => {
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
					address: "222.62.247.70",
					port: 54321,
				} satisfies SuccessResponse);
			});
		});
	});
});
