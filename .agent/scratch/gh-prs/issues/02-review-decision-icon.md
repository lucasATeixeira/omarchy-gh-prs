# 02 - Review decision icon

Status: ready-for-agent

Spec: `../spec.md`, section "Review and merge icons".

## What

Show the PR's **Review decision** as an icon on its row, after the robot icon. Make all row icons smaller.

## Acceptance criteria

- [ ] `QUERY` reads `reviewDecision`.
- [ ] `PullRequest` gets a typed field for the review decision, set in `toPullRequest`.
- [ ] `APPROVED` shows `nf-md-check_circle`; `CHANGES_REQUESTED` shows `nf-md-file_document_edit`; `REVIEW_REQUIRED` and `null` show no icon and take no space.
- [ ] The icon uses the normal text color and `Style.font.caption`.
- [ ] The robot icon also changes from `Style.font.bodySmall` to `Style.font.caption`.
- [ ] Status, Sections, and the Badge do not change.
- [ ] Tests cover parsing each `reviewDecision` value, `null` included.
- [ ] Checked by hand after `omarchy restart shell`.
