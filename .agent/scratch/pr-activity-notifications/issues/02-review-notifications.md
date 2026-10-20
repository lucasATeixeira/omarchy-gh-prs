# 02 - Review notifications

Status: ready-for-agent

Blocked by: 01

Spec: `../spec.md`, sections "Notification rules" (Review) and "Settings".

## What

Notify when a reviewer submits a **Review** that approves the PR or requests changes. This works in every repo, also in repos that do not require reviews.

## Acceptance criteria

- [ ] The main query also reads each reviewer's latest Review: review id, state, and author login. Its cost stays at 2 points, checked with `rateLimit(dryRun: true)`.
- [ ] `PullRequest` gets its latest Reviews, with a typed Review.
- [ ] The main seam returns one notification per new Review: a Review id that was not in the same PR's latest Reviews in the previous poll.
- [ ] Titles: `Approved by <login>` for `APPROVED`, `Changes requested by <login>` for `CHANGES_REQUESTED`. Body: `owner/repo#123 — <PR title>`. Clicking opens the PR.
- [ ] No notification for `COMMENTED` or `DISMISSED` Reviews, on the first poll, or for a PR seen for the first time.
- [ ] A second approval from the same reviewer after a new commit notifies again.
- [ ] Two reviewers in the same poll give two notifications.
- [ ] New settings `notifyApproved` and `notifyChangesRequested`, both `true` by default. Added to the manifest `defaults` and `schema` as `boolean`, with the labels "Notify when a PR is approved" and "Notify when changes are requested".
- [ ] Two toggles in the settings page under the master switch, after the existing three: "PR approved" and "Changes requested".
- [ ] Tests cover: `parseRun` reading latest Reviews; each notifying case; each skipped case; a second approval; two reviewers; and `notificationEnabled` for the two new keys, including a missing key.
- [ ] README: the notification paragraph and the settings table. The living spec `../../gh-prs/spec.md`: Settings and the line "No notifications for review decision, threads, or conflicts".

## Notes

- The Review decision row icon does not change. It still comes from `reviewDecision`.
