/**
 * Multi-language support - Language detection and configuration
 */

import path from "path";

export type SupportedLanguage =
  | "javascript"
  | "typescript"
  | "python"
  | "go"
  | "rust"
  | "java"
  | "csharp"
  | "ruby"
  | "php"
  | "swift"
  | "kotlin";

export interface LanguageConfig {
  name: string;
  extensions: string[];
  commentPatterns: RegExp[];
  packageFiles: string[];
  sourcePatterns: string[];
}

export const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  javascript: {
    name: "JavaScript",
    extensions: [".js", ".jsx", ".mjs", ".cjs"],
    commentPatterns: [/\/\/.*/, /\/\*[\s\S]*?\*\//],
    packageFiles: ["package.json"],
    sourcePatterns: ["**/*.js", "**/*.jsx", "**/*.mjs", "**/*.cjs"],
  },
  typescript: {
    name: "TypeScript",
    extensions: [".ts", ".tsx"],
    commentPatterns: [/\/\/.*/, /\/\*[\s\S]*?\*\//],
    packageFiles: ["package.json", "tsconfig.json"],
    sourcePatterns: ["**/*.ts", "**/*.tsx"],
  },
  python: {
    name: "Python",
    extensions: [".py"],
    commentPatterns: [/#.*/, /"""[\s\S]*?"""/, /'''[\s\S]*?'''/],
    packageFiles: [
      "requirements.txt",
      "setup.py",
      "pyproject.toml",
      "Pipfile",
      "poetry.lock",
    ],
    sourcePatterns: ["**/*.py"],
  },
  go: {
    name: "Go",
    extensions: [".go"],
    commentPatterns: [/\/\/.*/, /\/\*[\s\S]*?\*\//],
    packageFiles: ["go.mod", "go.sum"],
    sourcePatterns: ["**/*.go"],
  },
  rust: {
    name: "Rust",
    extensions: [".rs"],
    commentPatterns: [/\/\/.*/, /\/\*[\s\S]*?\*\//, /\/\/\/.*/, /\/\*\*[\s\S]*?\*\//],
    packageFiles: ["Cargo.toml", "Cargo.lock"],
    sourcePatterns: ["**/*.rs"],
  },
  java: {
    name: "Java",
    extensions: [".java"],
    commentPatterns: [/\/\/.*/, /\/\*[\s\S]*?\*\//, /\/\*\*[\s\S]*?\*\//],
    packageFiles: ["pom.xml", "build.gradle", "build.gradle.kts"],
    sourcePatterns: ["**/*.java"],
  },
  csharp: {
    name: "C#",
    extensions: [".cs"],
    commentPatterns: [/\/\/.*/, /\/\*[\s\S]*?\*\//, /\/\/\/.*/, /\/\*\*[\s\S]*?\*\//],
    packageFiles: [".csproj", ".sln"],
    sourcePatterns: ["**/*.cs"],
  },
  ruby: {
    name: "Ruby",
    extensions: [".rb"],
    commentPatterns: [/#.*/],
    packageFiles: ["Gemfile", "Gemfile.lock", ".ruby-version"],
    sourcePatterns: ["**/*.rb"],
  },
  php: {
    name: "PHP",
    extensions: [".php"],
    commentPatterns: [/\/\/.*/, /\/\*[\s\S]*?\*\//, /#.*/],
    packageFiles: ["composer.json", "composer.lock"],
    sourcePatterns: ["**/*.php"],
  },
  swift: {
    name: "Swift",
    extensions: [".swift"],
    commentPatterns: [/\/\/.*/, /\/\*[\s\S]*?\*\//],
    packageFiles: ["Package.swift"],
    sourcePatterns: ["**/*.swift"],
  },
  kotlin: {
    name: "Kotlin",
    extensions: [".kt", ".kts"],
    commentPatterns: [/\/\/.*/, /\/\*[\s\S]*?\*\//],
    packageFiles: ["build.gradle.kts", "settings.gradle.kts"],
    sourcePatterns: ["**/*.kt"],
  },
};

/**
 * Detect primary language of a project
 */
export function detectProjectLanguage(
  rootDir: string,
  fs: any
): SupportedLanguage[] {
  const detectedLanguages: SupportedLanguage[] = [];

  // Check for language-specific package files
  for (const [lang, config] of Object.entries(LANGUAGE_CONFIGS)) {
    for (const packageFile of config.packageFiles) {
      const fullPath = path.join(rootDir, packageFile);
      if (fs.existsSync(fullPath)) {
        detectedLanguages.push(lang as SupportedLanguage);
        break; // Found one package file for this language
      }
    }
  }

  // If no package files found, default to JS/TS
  if (detectedLanguages.length === 0) {
    detectedLanguages.push("javascript", "typescript");
  }

  return [...new Set(detectedLanguages)]; // Remove duplicates
}

/**
 * Get file extension for a path
 */
export function getFileExtension(filePath: string): string {
  const match = filePath.match(/\.([^.]+)$/);
  return match ? `.${match[1]}` : "";
}

/**
 * Detect language from file extension
 */
export function detectLanguageFromFile(
  filePath: string
): SupportedLanguage | null {
  const ext = getFileExtension(filePath);

  for (const [lang, config] of Object.entries(LANGUAGE_CONFIGS)) {
    if (config.extensions.includes(ext)) {
      return lang as SupportedLanguage;
    }
  }

  return null;
}

/**
 * Get all source patterns for detected languages
 */
export function getSourcePatterns(languages: SupportedLanguage[]): string[] {
  const patterns: string[] = [];

  for (const lang of languages) {
    patterns.push(...LANGUAGE_CONFIGS[lang].sourcePatterns);
  }

  return patterns;
}

/**
 * Get comment patterns for a language
 */
export function getCommentPatterns(language: SupportedLanguage): RegExp[] {
  return LANGUAGE_CONFIGS[language].commentPatterns;
}
