# Customization Guide

## Configuration File (`.roastrc.json`)

Create a `.roastrc.json` file in your project root to customize behavior.

### Basic Example

```json
{
  "thresholds": {
    "largeFile": 1000,
    "extremeFile": 3000
  },
  "scanners": {
    "disabled": ["test-coverage", "framework"]
  },
  "ignore": [
    "**/vendor/**",
    "**/third-party/**"
  ]
}
```

### Full Configuration

```json
{
  "thresholds": {
    "largeFile": 500,
    "extremeFile": 2000,
    "highChurn": 50,
    "criticalChurn": 100,
    "largePR": 20,
    "criticalPR": 40
  },
  "scanners": {
    "disabled": []
  },
  "ignore": [
    "**/vendor/**",
    "**/generated/**"
  ],
  "deductions": {
    "gitChurn": -3,
    "secret": -10,
    "missingTest": -1
  },
  "plugins": [
    "roast-plugin-graphql",
    "@company/roast-plugin-internal"
  ]
}
```

## Configuration Options

### Thresholds

Customize detection thresholds for various scanners:

| Option | Default | Description |
|--------|---------|-------------|
| `largeFile` | 500 | Line count for large file warning |
| `extremeFile` | 2000 | Line count for critical file warning |
| `highChurn` | 50 | Git changes in 6 months for warning |
| `criticalChurn` | 100 | Git changes in 6 months for critical |
| `largePR` | 20 | Files changed for PR warning |
| `criticalPR` | 40 | Files changed for critical PR warning |

**Example:**
```json
{
  "thresholds": {
    "largeFile": 1000,
    "extremeFile": 5000
  }
}
```

### Disable Scanners

Disable specific scanners you don't want to run:

**Available scanners:**
- `files` - File size and statistics
- `todos` - TODO/FIXME/HACK comments
- `dependencies` - Unused dependencies
- `circular-deps` - Import cycles
- `structure` - Directory structure issues
- `complexity` - Cyclomatic complexity
- `duplicates` - Duplicate code blocks
- `dead-exports` - Unused exports
- `type-safety` - TypeScript `any` usage
- `test-coverage` - Missing test files
- `git-insights` - File churn and PR patterns
- `security` - Hardcoded secrets
- `framework` - Next.js/React best practices

**Example:**
```json
{
  "scanners": {
    "disabled": ["test-coverage", "framework", "git-insights"]
  }
}
```

### Ignore Patterns

Add additional ignore patterns beyond the defaults:

**Default ignores:**
- `**/node_modules/**`
- `**/dist/**`
- `**/build/**`
- `**/.next/**`
- `**/coverage/**`
- `**/.git/**`

**Example:**
```json
{
  "ignore": [
    "**/vendor/**",
    "**/third-party/**",
    "**/generated/**",
    "**/legacy/**"
  ]
}
```

### Custom Deductions

Override health score deductions:

**Available deduction keys:**
- `unusedDependency` (default: -2)
- `todo` (default: -0.25)
- `largeFile` (default: -3)
- `extremeFile` (default: -5)
- `circularDependency` (default: -5)
- `complexFunction` (default: -2)
- `veryComplexFunction` (default: -4)
- `duplicateCode` (default: -3)
- `deadExport` (default: -1)
- `typeSafetyIssue` (default: -2)
- `criticalTypeSafety` (default: -5)
- `gitChurn` (default: -3)
- `largePRSize` (default: -2)
- `secret` (default: -10)
- `envInGit` (default: -10)
- `evalUsage` (default: -3)
- `missingTest` (default: -0.5)
- `frameworkViolation` (default: -2)

**Example:**
```json
{
  "deductions": {
    "missingTest": -1,
    "secret": -20,
    "todo": -0.5
  }
}
```

### Plugins

Load custom scanner plugins from npm packages:

**Example:**
```json
{
  "plugins": [
    "roast-plugin-graphql",
    "@mycompany/roast-plugin-internal"
  ]
}
```

See [Plugin Development](#plugin-development) below for details.

## Plugin Development

Create custom scanners as npm packages.

### Plugin Structure

```
roast-plugin-example/
├── package.json
├── index.js (or index.ts)
└── README.md
```

### Package Manifest (`package.json`)

```json
{
  "name": "roast-plugin-example",
  "version": "1.0.0",
  "description": "Example plugin for roast-my-codebase",
  "main": "index.js",
  "keywords": ["roast-plugin", "codebase-analysis"],
  "peerDependencies": {
    "roast-my-codebase": "^1.0.0"
  }
}
```

### Plugin Implementation

```javascript
// index.js
export default {
  name: "roast-plugin-example",
  version: "1.0.0",
  scanner: {
    name: "example",
    
    async scan(rootDir) {
      const findings = [];
      
      // Your scanner logic here
      // Use fast-glob, fs, path, etc.
      
      // Example: detect missing license headers
      const files = await glob("**/*.ts", { cwd: rootDir });
      
      for (const file of files) {
        const content = fs.readFileSync(file, "utf-8");
        if (!content.includes("Copyright")) {
          findings.push({
            id: `missing-license-${file}`,
            severity: "info",
            category: "license",
            message: `${file} missing license header`,
            file,
          });
        }
      }
      
      return { findings };
    }
  }
};
```

### Scanner Interface

Your plugin must export a `scanner` object implementing:

```typescript
interface Scanner {
  name: string;
  scan(rootDir: string): Promise<ScanResult>;
}

interface ScanResult {
  findings: Finding[];
  stats?: unknown;
}

interface Finding {
  id: string;                    // Unique ID
  severity: "info" | "warning" | "critical";
  category: string;              // Finding category (for roasts)
  message: string;               // Human-readable message
  file?: string;                 // Optional file path
  detail?: string;               // Optional detail
}
```

### TypeScript Plugin

```typescript
// index.ts
import { Scanner, ScanResult, Finding } from "roast-my-codebase";

const scanner: Scanner = {
  name: "graphql",
  
  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];
    
    // Your logic here
    
    return { findings };
  }
};

export default {
  name: "roast-plugin-graphql",
  version: "1.0.0",
  scanner,
};
```

### Publishing Your Plugin

1. **Name convention**: Use `roast-plugin-*` prefix
2. **Add keywords**: `["roast-plugin", "roast-my-codebase"]`
3. **Publish to npm**: `npm publish`

### Using Your Plugin

**Install:**
```bash
npm install roast-plugin-example
```

**Configure (`.roastrc.json`):**
```json
{
  "plugins": ["roast-plugin-example"]
}
```

**Run:**
```bash
roast-my-codebase .
```

### Example Plugins

**GraphQL Schema Checker:**
```javascript
export default {
  name: "roast-plugin-graphql",
  version: "1.0.0",
  scanner: {
    name: "graphql",
    
    async scan(rootDir) {
      const findings = [];
      const schemaFiles = await glob("**/*.graphql", { cwd: rootDir });
      
      for (const file of schemaFiles) {
        const content = fs.readFileSync(file, "utf-8");
        
        // Check for deprecated fields without @deprecated
        if (/deprecated/i.test(content) && !/@deprecated/.test(content)) {
          findings.push({
            id: `graphql-deprecated-${file}`,
            severity: "warning",
            category: "graphql-schema",
            message: `${file} mentions deprecated fields without @deprecated directive`,
            file,
          });
        }
      }
      
      return { findings };
    }
  }
};
```

**Database Migration Checker:**
```javascript
export default {
  name: "roast-plugin-migrations",
  version: "1.0.0",
  scanner: {
    name: "migrations",
    
    async scan(rootDir) {
      const findings = [];
      const migrations = await glob("**/migrations/*.sql", { cwd: rootDir });
      
      for (const file of migrations) {
        const content = fs.readFileSync(file, "utf-8");
        
        // Detect missing rollback
        const hasUp = /-- +?up/i.test(content);
        const hasDown = /-- +?down/i.test(content);
        
        if (hasUp && !hasDown) {
          findings.push({
            id: `migration-no-rollback-${file}`,
            severity: "warning",
            category: "migrations",
            message: `${file} missing DOWN migration for rollback`,
            file,
          });
        }
      }
      
      return { findings };
    }
  }
};
```

## Best Practices

### Configuration

1. **Start simple**: Begin with just thresholds or disabled scanners
2. **Commit `.roastrc.json`**: Share config with your team
3. **Use `.roastrc.example.json`**: Document available options
4. **Project-specific**: Different repos can have different configs

### Plugin Development

1. **Keep plugins focused**: One scanner per plugin
2. **Fast execution**: Aim for < 500ms scan time
3. **Graceful errors**: Don't crash on missing files
4. **Clear messages**: Make findings actionable
5. **Test thoroughly**: Include edge cases
6. **Document well**: Explain what your scanner detects

### Team Usage

**Recommended `.roastrc.json` for teams:**
```json
{
  "thresholds": {
    "largeFile": 800,
    "extremeFile": 2000
  },
  "scanners": {
    "disabled": ["test-coverage"]
  },
  "ignore": [
    "**/vendor/**",
    "**/legacy/**"
  ],
  "plugins": [
    "@company/roast-plugin-conventions"
  ]
}
```

**Per-developer overrides:**
Create `.roastrc.local.json` (gitignored) for personal preferences:
```json
{
  "scanners": {
    "disabled": ["git-insights"]
  }
}
```

## JSON Schema

For IDE autocomplete, reference the schema:

```json
{
  "$schema": "./node_modules/roast-my-codebase/roastrc.schema.json"
}
```

Or from the repo root:
```json
{
  "$schema": "./roastrc.schema.json"
}
```

## Examples

### Disable Scanners for Legacy Projects

```json
{
  "scanners": {
    "disabled": [
      "test-coverage",
      "type-safety",
      "complexity",
      "framework"
    ]
  }
}
```

### Strict Security Settings

```json
{
  "deductions": {
    "secret": -20,
    "envInGit": -20,
    "evalUsage": -10
  }
}
```

### Large Codebase Thresholds

```json
{
  "thresholds": {
    "largeFile": 1500,
    "extremeFile": 5000,
    "highChurn": 100,
    "criticalChurn": 200
  }
}
```

### Custom Plugin Ecosystem

```json
{
  "plugins": [
    "@company/roast-plugin-api-conventions",
    "@company/roast-plugin-database-patterns",
    "roast-plugin-graphql-schema",
    "roast-plugin-dockerfile-lint"
  ]
}
```

## Troubleshooting

### Config Not Loading

Check:
1. File is named exactly `.roastrc.json`
2. JSON is valid (no trailing commas)
3. File is in project root (where you run the command)
4. Check console for warning messages

### Plugin Not Loading

Check:
1. Plugin is installed: `npm list roast-plugin-example`
2. Plugin exports correct structure
3. Check console for warning messages
4. Verify plugin name in config matches package name

### Invalid Configuration

The tool will warn and fall back to defaults if:
- JSON is malformed
- Unknown scanner names in `disabled`
- Invalid threshold values (negative, zero)
- Plugin cannot be loaded

## Advanced: Programmatic Usage

```javascript
import { loadConfig } from "roast-my-codebase/config";
import { loadPlugins } from "roast-my-codebase/plugins";

const config = loadConfig("/path/to/project");
const plugins = await loadPlugins(config, "/path/to/project");

console.log(`Loaded ${plugins.length} plugins`);
```

## Community Plugins

Search npm for `roast-plugin` to find community-created plugins:

```bash
npm search roast-plugin
```

Popular plugins (examples):
- `roast-plugin-docker` - Dockerfile best practices
- `roast-plugin-graphql` - GraphQL schema validation
- `roast-plugin-sql` - SQL migration checks
- `roast-plugin-openapi` - OpenAPI spec validation

(Create these plugins and share with the community!)
