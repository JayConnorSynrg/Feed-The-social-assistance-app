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
  ]),
  // Guard: forbid `(supabase as any)` — this cast class hid real DB schema bugs.
  // Regenerate types and fix the underlying mismatch instead of silencing it.
  // Applies to hooks, components, and lib where the supabase client is used.
  {
    files: ["src/hooks/**/*.ts", "src/components/**/*.tsx", "src/lib/**/*.ts", "src/app/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSAsExpression[typeAnnotation.typeName.name='any'] > Identifier[name='supabase']",
          message: "Do not cast `supabase as any`. Regenerate types (`npx supabase gen types`) and fix the real type mismatch.",
        },
      ],
    },
  },
]);

export default eslintConfig;
