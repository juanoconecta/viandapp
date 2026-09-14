import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Git worktrees (see CLAUDE.md/CLAUDE session conventions) are separate
    // checkouts living under the repo root — their own .next/node_modules
    // aren't covered by the patterns above since those aren't `**/`-anchored.
    ".worktrees/**",
    // Vendored MapLibre worker chunks (copied verbatim from node_modules, see
    // CLAUDE.md's Turbopack note) — not our source.
    "public/maplibre-gl-worker.mjs",
    "public/maplibre-gl-shared.mjs",
  ]),
]);

export default eslintConfig;
