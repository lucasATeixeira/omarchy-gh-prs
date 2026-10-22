# 01 - Age PRs to review from their latest Review request

Status: ready-for-agent

See `../spec.md`.

## Acceptance

- The main query reads the user's teams and each PR's review request events.
- A PR to review is Stale when its latest Review request, or its creation when there is none, is older than the To review max age.
- A request to another person or team does not refresh the PR.
- The Authored Tab still uses the last update.
- The settings label and the README describe the new rule.
