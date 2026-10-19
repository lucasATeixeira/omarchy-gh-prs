# 03 - Unresolved threads icon

Status: ready-for-agent

Blocked by: 02

Spec: `../spec.md`, section "Review and merge icons".

## What

Show how many **Unresolved threads** a PR has, as an icon with a count, after the review decision icon.

## Acceptance criteria

- [ ] `QUERY` reads `reviewThreads(first: 100) { nodes { isResolved } }`.
- [ ] `PullRequest` gets a count of threads with `isResolved` false, set in `toPullRequest`.
- [ ] Every unresolved thread counts: any author, bots included, outdated included.
- [ ] The row shows `nf-md-comment_outline` followed by the count, both in the normal text color and `Style.font.caption`.
- [ ] No icon and no space when the count is 0.
- [ ] Tests cover: no threads, all resolved, a mix of resolved and unresolved.
- [ ] Checked by hand after `omarchy restart shell`.

## Notes

- Blocked by 02 because 02 sets the row icon size and order.
