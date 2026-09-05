import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { cargarEntornoIntegracion } from "./lib/testing/cargarEntornoIntegracion";

cargarEntornoIntegracion();

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.integration.test.ts"],
    fileParallelism: false,
    passWithNoTests: true,
    testTimeout: 30_000,
  },
});
