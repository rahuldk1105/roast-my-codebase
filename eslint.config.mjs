import typescriptEslint from "@typescript-eslint/eslint-plugin";
import security from "eslint-plugin-security";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslint,
      security: security,
    },
    rules: {
      // Security rules
      "security/detect-object-injection": "off", // Too many false positives
      "security/detect-non-literal-fs-filename": "off", // We validate paths with security utils
      "security/detect-eval-with-expression": "error",
      "security/detect-no-csrf-before-method-override": "error",
      "security/detect-buffer-noassert": "error",
      "security/detect-child-process": "warn",
      "security/detect-disable-mustache-escape": "error",
      "security/detect-new-buffer": "error",
      "security/detect-unsafe-regex": "error",

      // TypeScript rules
      "@typescript-eslint/no-explicit-any": "off", // We use any in some places intentionally
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // Ignore patterns
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      ".next/**",
      "coverage/**",
      "tests/fixtures/**",
    ],
  },
];
