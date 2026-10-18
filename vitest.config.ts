import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Testene av klubbskillet går mot en ekte Postgres-database. De oppretter
// egne testklubber og sletter dem etterpå, men skal likevel aldri kjøres
// mot produksjon - derfor må databasen velges eksplisitt med
// TEST_DATABASE_URL (en egen Neon-branch), og DATABASE_URL overstyres.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/oppsett.ts"],
    // Testene deler database og testklubber, så de kjøres etter hverandre.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
