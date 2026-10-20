# 02 - To review Tab

Status: ready-for-agent

Blocked by: 01

Spec: `../spec.md`, sections "Data" and "Modules and interfaces".

## What

The popup gets two Tabs under the header: `Authored <n>` and `To review <n>`. To review lists the PRs to review, read in the same fetch as the Authored PRs, and grouped into the same Sections. You switch Tabs with the mouse.

## Acceptance criteria

- [ ] The main query has a second search block for open PRs with `review-requested:@me`, newest first, at most 50, with the same PR fields.
- [ ] `parseRun` returns `prsToReview` next to `prs`. Both are empty on error.
- [ ] Tests at the `parseRun` seam: each list comes from its own block, an empty To review block gives an empty list, and a failed run gives an error with two empty lists.
- [ ] Two Tabs with counts sit under the header, above the separator. They use the shell's `ButtonGroup`, and a click switches the Tab.
- [ ] To review uses the reusable list with the text "No PRs to review". A fetch error shows on both Tabs.
- [ ] The popup starts on Authored and keeps the selected Tab while the shell runs.
- [ ] The Tabs are hidden while Settings is open.
- [ ] The bar Badge, the header badge, notifications, and the details query use only the Authored PRs.
- [ ] The README and the living spec describe the To review Tab and its search.
- [ ] The tests and `qmllint` pass.

## Notes

- Hand check after `omarchy restart shell`: ask someone for a review, or use a PR that already requests yours, and see it in To review.
