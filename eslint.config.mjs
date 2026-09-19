import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated from the migrations; regenerate with `npm run gen:types`.
    "types/database.ts",
  ]),

  {
    /**
     * The service-role key bypasses every RLS policy, so exactly one module is
     * allowed to read it. This rule keeps that true as the codebase grows: a
     * new route that reaches for process.env directly fails lint.
     */
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    ignores: [
      "lib/env.ts",
      // These read only NEXT_PUBLIC_* values, which ship to the browser anyway.
      "lib/supabase/client.ts", "lib/supabase/server.ts", "lib/supabase/anon.ts",
      "lib/supabase/middleware.ts", "lib/services/upload.ts", "lib/services/storage.ts",
      "lib/auth/identity-client.ts",
    ],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message:
            "Read configuration through lib/env.ts so every secret has exactly one entry point.",
        },
      ],
    },
  },

  {
    files: ["tests/**/*.{ts,tsx}", "scripts/**/*.{ts,mjs}", "e2e/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-restricted-properties": "off",
    },
  },
]);

export default eslintConfig;
