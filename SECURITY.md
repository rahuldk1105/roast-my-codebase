# Security Policy

## Supported Versions

We take security seriously and provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in `roast-my-codebase`, please report it responsibly.

### How to Report

**Please DO NOT create a public GitHub issue for security vulnerabilities.**

Instead, please report security issues via one of the following methods:

1. **Email:** security@example.com (replace with your actual security contact)
2. **GitHub Security Advisories:** Use the "Report a vulnerability" button in the Security tab of this repository
3. **Private disclosure:** Contact the maintainers directly via GitHub

### What to Include

Please include the following information in your report:

- **Description**: A clear description of the vulnerability
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Impact**: What an attacker could achieve by exploiting this vulnerability
- **Affected Versions**: Which versions are affected
- **Suggested Fix**: If you have ideas for a fix (optional)
- **Proof of Concept**: Code or commands demonstrating the issue (if applicable)

### Response Timeline

- **Initial Response**: We aim to acknowledge your report within **48 hours**
- **Status Update**: We will provide a status update within **7 days**
- **Fix Timeline**: Critical vulnerabilities will be patched within **14 days**
- **Public Disclosure**: Coordinated disclosure after a fix is released (typically 30-90 days)

## Security Best Practices

### For Users

When using `roast-my-codebase`, follow these security best practices:

1. **Plugin Safety**
   - Only install plugins from trusted sources
   - Review plugin code before installation
   - Use official plugins with the `roast-plugin-*` naming convention

2. **Configuration Files**
   - Keep `.roastrc.json` in version control
   - Don't store secrets or credentials in config files
   - Validate config changes in code review

3. **CI/CD Integration**
   - Use `--json` flag for machine-readable output
   - Set appropriate `--threshold` values for your project
   - Review findings before blocking builds

4. **File Permissions**
   - Run the tool with minimum required permissions
   - Don't run as root/administrator unless necessary
   - Be cautious with `--markdown-file` and `--badge` output paths

### For Plugin Developers

If you're developing plugins for `roast-my-codebase`:

1. **Naming Convention**
   - Use `roast-plugin-*` or `@scope/roast-plugin-*` naming
   - Follow npm package naming guidelines

2. **Security Checks**
   - Validate all user input
   - Use safe file system operations
   - Avoid executing shell commands with user input
   - Don't require elevated permissions

3. **Dependencies**
   - Keep dependencies up to date
   - Audit dependencies regularly with `npm audit`
   - Use minimal dependencies

4. **Code Review**
   - Document security considerations
   - Include tests for edge cases
   - Follow secure coding practices

## Known Security Considerations

### Plugin System

The plugin system allows dynamic loading of npm packages. While we validate plugin names and paths, users should:

- Only install plugins from trusted sources
- Review plugin code before use
- Be aware that plugins execute with the same permissions as the CLI

### File System Access

`roast-my-codebase` reads files from your project directory. Ensure:

- You trust the codebase being analyzed
- Symbolic links don't point to sensitive locations
- You review the tool's output before sharing publicly

### Git Operations

When using `--compare` mode:

- Branch names are validated to prevent command injection
- Temporary worktrees are created in the system temp directory
- Worktrees are cleaned up automatically after comparison

### Configuration Files

The `.roastrc.json` file is parsed with security measures:

- Prototype pollution protection
- Type validation for all fields
- Sanitization of dangerous keys

## Security Features

### Built-in Protections

1. **Input Validation**
   - Plugin names validated against whitelist pattern
   - Git branch names sanitized
   - File paths validated to prevent traversal
   - JSON parsing with prototype pollution protection

2. **Rate Limiting**
   - Watch mode debounces file changes (500ms)
   - Prevents DoS via rapid file modifications

3. **Error Sanitization**
   - Error messages don't expose file paths
   - Sensitive information redacted from logs
   - Stack traces only in DEBUG mode

4. **Resource Limits**
   - File size limits prevent memory exhaustion
   - Regex timeouts prevent ReDoS attacks
   - Controlled temporary file creation

### Security Scanners

The tool includes security-focused scanners:

- **Secrets Detection**: Finds hardcoded API keys, tokens, private keys
- **Environment Files**: Detects `.env` files in git
- **Code Injection**: Identifies dangerous `eval()` usage
- **Dependency Audit**: (Run `npm audit` separately)

## Disclosure Policy

We follow **coordinated disclosure**:

1. Security researcher reports vulnerability privately
2. We acknowledge and investigate the report
3. We develop and test a fix
4. We release a security patch
5. After users have time to update (typically 30 days), we publish a security advisory
6. We credit the researcher (if desired)

## Security Updates

Security updates are announced via:

- GitHub Security Advisories
- GitHub Releases (with `[SECURITY]` tag)
- npm package release notes
- Project README (for critical issues)

## Contact

For security concerns, contact:

- **Email**: security@example.com (replace with actual contact)
- **GitHub**: [@maintainer-username](https://github.com/maintainer-username)

## Acknowledgments

We thank the following researchers for responsible disclosure:

<!-- Add security researchers who have reported issues -->

---

**Last Updated**: 2026-06-26

We appreciate your efforts to responsibly disclose your findings and will make every effort to acknowledge your contributions.
