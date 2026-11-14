# Security policy

## Supported versions

The latest commit on `main` is the only supported version. This is a hackathon
prototype, not a long-lived release line.

## Repository controls

- Secret scanning and push protection are enabled.
- Dependabot alerts and security updates are enabled.
- Every pull request runs gitleaks, npm audit and a Python dependency audit.
- `main` is protected by the `main protection` ruleset; `ci-required` must pass.
- Model weights, archives, audio and files over 5 MiB are blocked by the local
  pre-commit hook and by the `Repository guard` CI job.

## Scope

This is a hackathon prototype and a research artefact. It is not a production banking
component. The security properties it does claim are:

- no network egress except `127.0.0.1`;
- no collection or storage of page values;
- no modification of page source code, handlers or application state;
- no automatic submission, no bypassing confirmation screens;
- protected financial values are byte-identical before and after translation.

## Reporting

Open a private GitHub security advisory at
<https://github.com/Zeusse-Neumbi/z-team-lingua/security/advisories/new> or
email the team. Do not open a public issue for a vulnerability that could affect
the demo environment.

Include the affected component, a minimal reproduction, the likely impact and a
suggested fix if you have one. If a credential may have leaked, say so
immediately so it can be revoked or rotated. Never attach real page values,
personal data, credentials or private learner material to a report.

## Out of scope

- The target test page's own implementation.
- Real banking operations; the project only uses simulated data.
- Browser-level compromise, malicious extensions already installed, or a compromised OS.
- Denial of service against the local API.

## Safe demo rules

- Use fictional data only.
- Do not enter real personal or banking data.
- Do not point the extension at a real bank's production interface.
- Stop and restore the page before closing the demo.
