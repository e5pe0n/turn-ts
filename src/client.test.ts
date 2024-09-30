import { describe, expect } from "vitest";
import { Client, Response } from "./client.js";

describe("req", () => {
	describe("udp", () => {
		describe("Binding Request", () => {
			it("sends a request then receives a success response", async () => {
				const client = new Client({
					address: "127.0.0.1",
					port: 13345,
					protocol: "udp",
				});
				const res = await client.req("request", "binding");
				expect(res).toEqual({ address: "222.62.247.70" } satisfies Response);
			});
		});
	});
});
