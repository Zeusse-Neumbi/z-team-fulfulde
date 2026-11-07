# Security policy

## Scope

This is a hackathon prototype and a research artefact. It is not a production banking
component. The security properties it does claim are:

- no network egress except `127.0.0.1`;
- no collection or storage of page values;
- no modification of page source code, handlers or application state;
- no automatic submission, no bypassing confirmation screens;
- protected financial values are byte-identical before and after translation.

## Reporting

Please open a private GitHub security advisory or email the team. Do not open a public
issue for a vulnerability that could affect the demo environment.

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
