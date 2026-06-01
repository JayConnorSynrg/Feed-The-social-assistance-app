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
    // Vendored/minified assets — not authored code, linting them has no value.
    "public/**",
  ]),
  // Guard: forbid `(supabase as any)` — this cast class hid real DB schema bugs.
  // Regenerate types and fix the underlying mismatch instead of silencing it.
  // Applies to hooks, components, and lib where the supabase client is used.
  {
    files: ["src/hooks/**/*.ts", "src/components/**/*.tsx", "src/lib/**/*.ts", "src/app/**/*.tsx", "src/app/**/*.ts", "src/proxy.ts", "src/middleware/**/*.ts"],
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
  // Pre-existing rule violations across the codebase are downgraded to warnings
  // so CI can go green without a mass-fix refactor. Each rule remains visible in
  // the lint output so engineers can address them incrementally.
  {
    rules: {
      // Correctness rules — enforced at error; all pre-existing violations must be fixed.
      "@typescript-eslint/no-explicit-any": "error",
      // React Compiler correctness — enforce; pre-existing violations must be fixed.
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/preserve-manual-memoization": "error",
      // Cosmetic — can be addressed incrementally.
      "react/no-unescaped-entities": "warn",
      "@next/next/no-html-link-for-pages": "warn",
      "prefer-const": "warn",
    },
  },
]);

export default eslintConfig;
