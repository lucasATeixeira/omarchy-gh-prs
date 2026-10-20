# 03 - Author login in To review rows

Status: ready-for-agent

Blocked by: 02

Spec: `../spec.md`, section "Modules and interfaces".

## What

Each To review row shows who wrote the PR, as `@<author>` in muted text after `repo#number`. Authored rows do not change.

## Acceptance criteria

- [ ] Both search blocks read the PR author's login, and each `PullRequest` has `author`.
- [ ] A PR without an author gives `ghost`, like other logins.
- [ ] Tests at the `parseRun` seam cover the author and the `ghost` case.
- [ ] To review rows show `@<author>` after `repo#number`, and the title elides to make room.
- [ ] Authored rows show no author.
- [ ] The tests and `qmllint` pass.

## Notes

- Hand check after `omarchy restart shell`: a long title still elides, and the draft label still shows.
