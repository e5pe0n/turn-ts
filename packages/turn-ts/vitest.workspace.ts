import { configDefaults, defineWorkspace } from "vitest/config";

const sequentials: string[] = [
  "./src/client.test.ts",
  "./src/handlers/send.test.ts",
  "./src/handlers/data.test.ts",
];

export default defineWorkspace([
  {
    test: {
      name: "parallel",
      exclude: [...configDefaults.exclude, ...sequentials],
    },
  },
  {
    test: {
      name: "sequential",
      include: sequentials,
      pool: "forks",
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
    },
  },
]);
