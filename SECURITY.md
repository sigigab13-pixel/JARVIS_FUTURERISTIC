# Security Policy

## Supported project

JARVIS is an actively developing project. Security practices and infrastructure may change as the platform evolves.

## Reporting a vulnerability

If you discover a security vulnerability, please do **not** publish sensitive details in a public GitHub issue.

Instead, contact the project maintainer privately through an appropriate private communication channel available to the repository owner.

When reporting a vulnerability, include:

- A clear description of the issue
- The affected component or file
- Steps to reproduce the issue, when safe to provide
- Potential impact
- Any suggested mitigation

Please do not include passwords, API keys, OAuth client secrets, access tokens, or other private credentials in the report.

## Secrets

JARVIS uses deployment-side secret management for sensitive service credentials.

Examples include:

- Google OAuth credentials
- Google Cloud TTS credentials
- Hugging Face API tokens
- User authorization tokens

These values must remain outside the public repository.

## If a secret is accidentally committed

Treat the credential as compromised immediately.

1. Revoke or rotate the credential with the relevant provider.
2. Remove the secret from the project.
3. Check deployment configuration for the replacement credential.
4. Report the incident privately rather than publishing the secret.

Removing a secret from a later commit does not make an exposed credential safe again.

## Responsible disclosure

Please allow reasonable time for a security issue to be investigated and addressed before publicly disclosing sensitive technical details.

Thank you for helping keep JARVIS and its users safer.
