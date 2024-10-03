import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["./src/client.test.ts", "./src/server.test.ts"],
		pool: "forks",
		poolOptions: {
			forks: {
				singleFork: true,
			},
		},
	},
});
