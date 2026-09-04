import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // The real `server-only` package throws unless resolved under
      // Next.js's "react-server" export condition, which Node/Vitest never
      // sets. Alias it straight to the package's own empty no-op stub so
      // server-only modules stay importable in tests without affecting how
      // any other package resolves.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    passWithNoTests: true,
  },
});
