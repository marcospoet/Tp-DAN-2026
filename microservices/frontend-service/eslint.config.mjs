import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

export default defineConfig([
  globalIgnores([".next/**", "node_modules/**", "public/**", "next-env.d.ts"]),
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // shadcn/ui genera componentes con interfaces vacías y require()
      "@typescript-eslint/no-empty-object-type": "off",
      // Reglas nuevas de react-hooks v6 (preparación para React Compiler):
      // marcan patrones establecidos del codebase (setState en mount effects,
      // refs en render de shadcn). Quedan visibles como warnings hasta que se
      // refactoricen — no bloquean el lint.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
])
