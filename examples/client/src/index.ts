import { Client } from "stun-ts";

{
	const client = new Client({
		address: "74.125.250.129", // stun.l.google.com
		port: 19302,
		protocol: "udp",
	});
	const res = await client.req("request", "binding");
	console.log(res);
}
