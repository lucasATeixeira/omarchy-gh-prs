# 04 - Conflict icon

Status: ready-for-agent

Blocked by: 03

Spec: `../spec.md`, section "Review and merge icons".

## What

Show a **Conflict** icon on the row when the PR cannot merge because of conflicts, after the unresolved threads icon.

## Acceptance criteria

- [ ] `QUERY` reads `mergeable`.
- [ ] `PullRequest` gets a boolean that is true only when `mergeable` is `CONFLICTING`, set in `toPullRequest`.
- [ ] The row shows `nf-md-alert` in the normal text color and `Style.font.caption`.
- [ ] `MERGEABLE` and `UNKNOWN` show no icon and take no space.
- [ ] Tests cover `CONFLICTING`, `MERGEABLE`, and `UNKNOWN`.
- [ ] Checked by hand after `omarchy restart shell`.

## Notes

- Blocked by 03 only to keep the row order edits in sequence.
