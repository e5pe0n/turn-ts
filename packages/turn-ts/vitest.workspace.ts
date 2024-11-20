import { configDefaults, defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "parallel",
      exclude: [...configDefaults.exclude, "./src/client.test.ts"],
    },
  },
  {
    test: {
      name: "sequential",
      include: ["./src/client.test.ts"],
      pool: "forks",
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
    },
  },
]);