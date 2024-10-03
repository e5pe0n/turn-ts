import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		exclude: [
			...configDefaults.exclude,
			"./src/client.test.ts",
			"./src/server.test.ts",
		],
	},
});
