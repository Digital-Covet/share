import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@generated": fromRoot("./generated"),
      "@": fromRoot("./src"),
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});
