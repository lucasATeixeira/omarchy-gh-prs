# 02 - Review decision icon

Status: resolved

Spec: `../spec.md`, section "Review and merge icons".

## What

Show the PR's **Review decision** as an icon on its row, after the robot icon. Make all row icons smaller.

## Acceptance criteria

- [x] `QUERY` reads `reviewDecision`.
- [x] `PullRequest` gets a typed field for the review decision, set in `toPullRequest`.
- [x] `APPROVED` shows `nf-md-check_circle`; `CHANGES_REQUESTED` shows `nf-md-file_document_edit`; `REVIEW_REQUIRED` and `null` show no icon and take no space.
- [x] The icon uses the normal text color and `Style.font.caption`.
- [x] The robot icon also changes from `Style.font.bodySmall` to `Style.font.caption`.
- [x] Status, Sections, and the Badge do not change.
- [x] Tests cover parsing each `reviewDecision` value, `null` included.
- [ ] Checked by hand after `omarchy restart shell`.

## Comments

Implemented on branch `ci-review-icons`. The hand check after `omarchy restart shell` is left to the user.
