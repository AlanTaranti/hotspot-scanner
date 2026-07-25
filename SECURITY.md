# Security Policy

## Trust model

**hotspot-scanner** is a local-only CLI and library. During a scan or compare:

- **No outbound network calls** — the tool does not contact remote APIs, send telemetry, or upload source code.
- **Local data only** — analysis reads your Git history (via the `git` binary) and source files on disk in the target repository.
- **No secrets handling** — the scanner does not read environment variables for credentials or manage authentication tokens.

Installing or cloning this repository requires network access to fetch the package and its dependencies. That is outside the scan runtime.

For the user-facing zero-network callout, see [README.md](README.md#the-solution).

## Supported versions

Security fixes are applied to the latest release on the default branch. There is no long-term support matrix for older versions.

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report security issues through [GitHub Security Advisories](https://github.com/taranti/hotspot-scanner/security/advisories/new) for this repository:

https://github.com/taranti/hotspot-scanner/security/advisories/new

Include:

- A description of the vulnerability and its impact
- Steps to reproduce (CLI flags, config file, or programmatic API call)
- Affected version or commit, if known
- Suggested fix or mitigation, if you have one

We will acknowledge receipt and work on a fix. Coordinated disclosure is preferred — please allow reasonable time before public disclosure.

## Scope

In scope:

- Arbitrary code execution, path traversal, or command injection via CLI flags, config files, or programmatic API inputs
- Unintended network egress during scan/compare
- Information disclosure beyond the intended repository scope

Out of scope:

- Findings in third-party dependencies (report upstream; we will track updates)
- Social engineering or physical access scenarios
- Issues requiring a compromised host or malicious repository content that `git` itself would already execute
