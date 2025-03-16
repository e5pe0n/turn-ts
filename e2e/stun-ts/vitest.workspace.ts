import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "docker",
      include: ["docker.test.ts"],
    },
  },
  {
    test: {
      name: "compatibility",
      include: ["compatibility.test.ts"],
    },
  },
]);
