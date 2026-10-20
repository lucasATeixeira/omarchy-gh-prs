# 09 - Approval count icon

Status: resolved

Spec: `../spec.md`, section "Review and merge icons".

## What

Show how many **Approvals** a PR has, as `nf-md-check_circle` with a count. It replaces the icon that showed a Review decision of `APPROVED`.

## Acceptance criteria

- [x] `PullRequest` gets a typed `approvalCount` field, set in `toPullRequest` from `latestReviews`: the reviews with state `APPROVED`.
- [x] `QUERY` does not change.
- [x] The row shows `nf-md-check_circle` followed by the count, as `󰗠 2`, in the normal text color and `Style.font.caption`.
- [x] The icon shows whenever the count is above 0, whatever the Review decision is. No icon and no space when the count is 0.
- [x] The Review decision icon shows only `nf-md-file_document_edit` for `CHANGES_REQUESTED`. `APPROVED` is removed from `reviewDecisionIcons`.
- [x] Row order: Status dot, robot, Approval icon, Review decision icon, Unresolved thread icon, Conflict icon.
- [x] Approval notifications and their icon do not change.
- [x] Tests cover: no reviews, several approvals, approvals mixed with other states, a `DISMISSED` review.
- [ ] Checked by hand after `omarchy restart shell`.

## Comments

Implemented on branch `approval-count-icon`. The hand check after `omarchy restart shell` is left to the user.
