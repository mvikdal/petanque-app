import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Klubbskillet (2026-10-18): all datatilgang skal gå via lib/data/, der
  // hver spørring filtreres på klubb. Sider, actions og komponenter får
  // derfor ikke importere Prisma direkte. Engangsskript i scripts/ er unntatt.
  {
    files: ["app/**", "components/**", "lib/**", "proxy.ts"],
    ignores: ["lib/data/**", "lib/prisma.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/prisma",
              message: "Bruk de klubbfiltrerte funksjonene i lib/data/ i stedet.",
            },
            {
              name: "@prisma/client",
              message: "Bruk de klubbfiltrerte funksjonene i lib/data/ i stedet.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
