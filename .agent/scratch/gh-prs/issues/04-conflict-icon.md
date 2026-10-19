# 04 - Conflict icon

Status: resolved

Blocked by: 03

Spec: `../spec.md`, section "Review and merge icons".

## What

Show a **Conflict** icon on the row when the PR cannot merge because of conflicts, after the unresolved threads icon.

## Acceptance criteria

- [x] `QUERY` reads `mergeable`.
- [x] `PullRequest` gets a boolean that is true only when `mergeable` is `CONFLICTING`, set in `toPullRequest`.
- [x] The row shows `nf-md-alert` in the normal text color and `Style.font.caption`.
- [x] `MERGEABLE` and `UNKNOWN` show no icon and take no space.
- [x] Tests cover `CONFLICTING`, `MERGEABLE`, and `UNKNOWN`.
- [ ] Checked by hand after `omarchy restart shell`.

## Notes

- Blocked by 03 only to keep the row order edits in sequence.

## Comments

Implemented on branch `ci-review-icons`. The hand check after `omarchy restart shell` is left to the user.
